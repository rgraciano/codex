


import 'reflect-metadata';

import { PhaseStack, Phase } from './actions/phase';

import { Board, BoardBuilding, BuildingType } from './board';

import { FruitNinja } from './cards/neutral/FruitNinja';
import { Tenderfoot } from './cards/neutral/Tenderfoot';
import { OlderBrother } from './cards/neutral/OlderBrother';
import { TimelyMessenger } from './cards/neutral/TimelyMessenger';

import { Card } from './cards/card';

import { ObjectMap } from './game_server';

export type ServerEvent = RuneEvent | 'Error' | 'ClearPatrolZone' | 'CollectGold' | 'ReadyCard' | 'UpkeepChoices' | 'UpkeepOver' 
                        | 'PaidFor' | 'Arrives' | 'TokenOrRune' | 'WouldDie' | 'Scavenger' | 'Technician' | 'DiscardedCards' | 'Graveyard' | 'PutInHand' | 'ReturnToHeroZone'
                        | 'BuildingDamage' | 'GameOver' | 'BuildingDestroyed' | 'CardToDestroy' | 'AttackComplete' | 'TowerDetected'
                        | 'PossibleAttackTargets';
export type RuneEvent =  'timeRunes' | 'damage' | 'plusOneOne' | 'minusOneOne' | 'featherRunes' | 'crumblingRunes';

export class Game {
    player1Board: Board;
    player2Board: Board;

    phaseStack: PhaseStack;

    activePlayer: number = 1;

    events: Array<EventDescriptor> = [];

    gameStateId: string; // used at the end of turn to save this game

    setupNewGame() {
        this.player1Board = new Board(1);
        this.player2Board = new Board(2);

        this.player1Board.base = new BoardBuilding('Base', true);
        this.player2Board.base = new BoardBuilding('Base', true);

        this.player1Board.discard = [new Tenderfoot(1), new TimelyMessenger(1), new OlderBrother(1), 
            new FruitNinja(1), new Tenderfoot(1), new TimelyMessenger(1),
            new OlderBrother(1), new FruitNinja(1), new Tenderfoot(1), new TimelyMessenger(1)];

        this.player2Board.discard = [new Tenderfoot(2), new TimelyMessenger(2), new OlderBrother(2), 
                new FruitNinja(2), new Tenderfoot(2), new TimelyMessenger(2),
                new OlderBrother(2), new FruitNinja(2), new Tenderfoot(2), new TimelyMessenger(2)];

        Card.idToCardMap.forEach(card => card.setupGameReferences(this));

        this.player1Board.drawCards(5);
        this.player2Board.drawCards(5);

        this.phaseStack = new PhaseStack();
        this.phaseStack.setupForNewGame();


    }

    serialize(): ObjectMap {
        return {
            events: Object.assign({}, this.events),
            activePlayer: this.activePlayer,
            player1Board: this.player1Board.serialize(),
            player2Board: this.player2Board.serialize(),
            phaseStack: this.phaseStack.serialize(),
            gameStateId: this.gameStateId
        };
    }

    static deserialize(pojo: ObjectMap): Game {
        let game: Game = new Game();
        game.activePlayer = <number>pojo.activePlayer;
        game.player1Board = Board.deserialize(<ObjectMap>pojo.player1Board, game);
        game.player2Board = Board.deserialize(<ObjectMap>pojo.player2Board, game);
        game.phaseStack = PhaseStack.deserialize(<ObjectMap>pojo.phaseStack);

        // need to setup the references AFTER the whole thing has been initialized
        Card.idToCardMap.forEach(card => card.setupGameReferences(game));
        return game;
    }

    processGameState(): EventDescriptor[] {
        let results: EventDescriptor[];

        results = this.processBoardState(this.player1Board);
        results.push(...this.processBoardState(this.player2Board));

        // check everything in play to see if anything has died. if it has, create a new phase like Destroy and have a DestroyChoice
        // for everything we see as dying simultaneously.  cleanUpPhases() should then be able to trigger dies() for our DestroyChoice,
        // which will trigger some stuff and life will go on
        let cardsToDestroy: Card[] = this.getAllActiveCards().filter(card => 
            { 
                if (card && (card.cardType == 'Hero' || card.cardType == 'Unit') && card.shouldDestroy()) {
                    results.push(new EventDescriptor('CardToDestroy', card.name + ' will be destroyed', { cardId: card.cardId }));
                    return true;
                }
            });

        if (cardsToDestroy.length > 0) {
            this.phaseStack.addToStack(new Phase('Destroy', [ 'DestroyChoice']));
            this.phaseStack.topOfStack().markCardsToResolve(cardsToDestroy);
        }

        return results;
    }

    processBoardState(board: Board): EventDescriptor[] {
        let results: EventDescriptor[] = [];

        // check base buildings. if base blown up, gg!
        let baseDestroyed = board.destroyIfRequired('Base');
        if (baseDestroyed) {
            this.phaseStack.addToStack(new Phase('GameOver', []));
            return baseDestroyed; // if the game is over, no need to figure everything else out. just end it
        }
        
        // check other buildings. if health is <= 0, destroy() and do damage to base
        let buildingsToCheck: BuildingType[] = <BuildingType[]>[ 'Tech 1', 'Tech 2', 'Tech 3', 'AddOn' ];

        for (let building in buildingsToCheck) {
            let bldgDestroyed = board.destroyIfRequired(<BuildingType>building);
            if (bldgDestroyed)
                results.push(...bldgDestroyed);
        }

        return results;
    }

    getBoardAndOpponentBoard(): Array<Board> {
        if (this.activePlayer == 1) {
            return [ this.player1Board, this.player2Board ];
        }
        else {
            return [ this.player2Board, this.player1Board ];
        }
    }

    addEvent(event: EventDescriptor): void {
        if (event) this.events.push(event);
    }

    addEvents(events: Array<EventDescriptor>): void {
        if (events && events.length > 0) this.events.push(...events);
    }

    /** Find a card, wherever it may be, and remove it from play. Card MUST be removed or this will throw an error */
    removeCardFromPlay(card: Card) {
        let found = false;

        if (!this.removeCardFromBoard(this.player1Board, card))
            found = this.removeCardFromBoard(this.player2Board, card);
        else
            found = true;

        if (!found)
            throw new Error('Tried to remove ' + card.cardId + ' from play, but could not find it');
    }

    cardIsInAnActiveSpace(board: Board, card: Card): boolean {
        return board.getPatrolZoneAsArray().concat(...board.inPlay, board.effects).filter(localCard => localCard === card).length > 0;
    }

    cardIsPatrolling(board: Board, card: Card): boolean {
        return board.getPatrolZoneAsArray().filter(localCard => localCard === card).length > 0;
    }

    cardIsInPlay(board: Board, card: Card): boolean {
        return board.inPlay.filter(localCard => localCard === card).length > 0;
    }

    cardIsInHand(board: Board, card: Card): boolean {
        return board.hand.filter(localCard => localCard === card).length > 0;
    }

    removeCardFromBoard(board: Board, card: Card): boolean {
        for (let i in board.patrolZone) {
            if (board.patrolZone[i] == card) {
                board.patrolZone[i] = null;
                return true;
            }
        }

        if (this.removeCardFromSpace(board.inPlay, card))
            return true;
        if (this.removeCardFromSpace(board.effects, card))
            return true;
        if (this.removeCardFromSpace(board.hand, card))
            return true;

        return false;
    }

    removeCardFromSpace(space: Card[], card: Card): boolean {
        let index = space.findIndex(curCard => curCard == card);
        if (index >= 0) {
            space.splice(index);
            return true;
        }
        else
            return false;
    }

    getAllActiveCards(useBoard?: Board): Card[] {
        if (useBoard)
            return useBoard.inPlay.concat(useBoard.getPatrolZoneAsArray(), useBoard.effects);
        else
            return this.player1Board.inPlay.concat(this.player1Board.getPatrolZoneAsArray(), this.player1Board.effects,
                                                 this.player2Board.inPlay, this.player2Board.getPatrolZoneAsArray(), this.player2Board.effects);
    }

    getAllAttackableCards(space: Card[]): Card[] {
        return space.filter(card => {
            if (card.cardType != 'Hero' && card.cardType != 'Unit' && card.cardType != 'Building')
                return false;

            let attrs = card.effective();
            
            if (attrs.invisible || attrs.unattackable)
                return false;

            return true;
        })
    }

    markMustResolveForCardsWithFnName(space: Card[], fnName: string) {
        // find all of the cards with handlers that match
        let foundCards: Card[] = Game.findCardsWithFunction(space, fnName);
    
        // add all of those cards to the list of allowedActions, automatically removing those that were already resolved and ensuring there are no duplicates
        this.phaseStack.topOfStack().markCardsToResolve(foundCards, fnName);
    }

    /** 
     * Searches an array of cards for every card mapping to an interface (eg, implements onUpkeep). For example, findCardsWithHandlers(board.InPlay, 'onUpkeep')
     * 
     * @param implementsFunction The function on an interface that would indicate this interface is implemented, eg, 'onUpkeep'
     */
    static findCardsWithFunction(cards: Card[], implementsFunction: string): Card[] {
        return cards.filter(card => {
            return (card && Reflect.has(card, implementsFunction));
        });
    }

    /**
     * Finds cards matching arbitary criteria, does a thing to those cards, and returns EventDescriptors describing what we did.
     * 
     * @param cards search space
     * @param matching do something if this returns true
     * @param andDo what do
     */
    static findAndDoOnCards(space: Card[], matching: (card: Card) => boolean, andDo: (card: Card) => EventDescriptor) : Array<EventDescriptor> {
        let cards = space.filter(matching);
        return cards.map(andDo);       
    }    
}

/** Describes something that happened in the game, so the UI can tell the user later and perhaps do something visually  */
export class EventDescriptor {
    eventType: ServerEvent;

    // stores any additional data required to communicate this event to the client
    context: ObjectMap;

    description: string;

    constructor(eventType: ServerEvent, description: string, context?: ObjectMap) {
        this.eventType = eventType;
        this.description = description;
        this.context = context ? context : {};
    }
}


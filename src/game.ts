


import 'reflect-metadata';

import { PhaseStack, ResolveMap } from './actions/phase';

import { Board } from './board';

import { FruitNinja } from './cards/neutral/FruitNinja';
import { Tenderfoot } from './cards/neutral/Tenderfoot';
import { OlderBrother } from './cards/neutral/OlderBrother';
import { TimelyMessenger } from './cards/neutral/TimelyMessenger';

import { Card } from './cards/card';

import { ObjectMap } from './game_server';


export class Game {
    player1Board: Board;
    player2Board: Board;

    phaseStack: PhaseStack;

    activePlayer: number = 1;

    events: Array<EventDescriptor> = [];

    setupNewGame() {
        this.player1Board = new Board(1);
        this.player2Board = new Board(2);

        this.player1Board.discard = [new Tenderfoot(this, 1), new TimelyMessenger(this, 1), new OlderBrother(this, 1), 
            new FruitNinja(this, 1), new Tenderfoot(this, 1), new TimelyMessenger(this, 1),
            new OlderBrother(this, 1), new FruitNinja(this, 1), new Tenderfoot(this, 1), new TimelyMessenger(this, 1)];

        this.player2Board.discard = [new Tenderfoot(this, 2), new TimelyMessenger(this, 2), new OlderBrother(this, 2), 
                new FruitNinja(this, 2), new Tenderfoot(this, 2), new TimelyMessenger(this, 2),
                new OlderBrother(this, 2), new FruitNinja(this, 2), new Tenderfoot(this, 2), new TimelyMessenger(this, 2)];

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
            phaseStack: this.phaseStack.serialize()
        };
    }

    static deserialize(pojo: ObjectMap): Game {
        let game: Game = new Game();
        game.activePlayer = <number>pojo.activePlayer;
        game.player1Board = Board.deserialize(<ObjectMap>pojo.player1Board, game);
        game.player2Board = Board.deserialize(<ObjectMap>pojo.player2Board, game);
        game.phaseStack = PhaseStack.deserialize(<ObjectMap>pojo.phaseStack);
        return game;
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
        this.events.push(event);
    }

    addEvents(events: Array<EventDescriptor>): void {
        this.events.push(...events);
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

    markMustResolveForHandlers(space: Card[], fnName: string, setExtraMapParams?: (map: ResolveMap) => ResolveMap) {
        // find all of the cards with handlers that match
        let foundCards: Card[] = Game.findCardsWithFunction(space, fnName);
    
        // add all of those cards to the list of allowedActions, automatically removing those that were already resolved and ensuring there are no duplicates
        this.phaseStack.topOfStack().markMustResolve(foundCards, fnName, setExtraMapParams);
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
export type ServerEvent = RuneEvent | 'Error' | 'ClearPatrolZone' | 'CollectGold' | 'ReadyCard' | 'UpkeepChoices' | 'UpkeepOver' 
| 'PaidFor' | 'Arrives' | 'TokenOrRune' | 'WouldDie' | 'Scavenger' | 'Technician' | 'DiscardedCards' | 'Graveyard';
export type RuneEvent =  'timeRunes' | 'damage' | 'plusOneOne' | 'minusOneOne' | 'featherRunes' | 'crumblingRunes';


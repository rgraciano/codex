import 'reflect-metadata';

import { PhaseStack, Phase, Action } from './actions/phase';

import { Board, BoardBuilding, BuildingType, TechBuilding, AddOn } from './board';

import { TimelyMessenger } from './cards/neutral/TimelyMessenger';

import { Card } from './cards/card';

import { ObjectMap } from './game_server';
import { TwoAbilitiesTest } from './cards/test/TwoAbilitiesTest';
import { BoostUnitTest } from './cards/test/BoostUnitTest';
import { RiverMontoya } from './cards/neutral/RiverMontoya';

export type ServerEvent =
    | RuneEvent
    | 'Error'
    | 'ClearPatrolZone'
    | 'CollectGold'
    | 'ReadyCard'
    | 'UpkeepChoices'
    | 'UpkeepOver'
    | 'PaidFor'
    | 'Arrives'
    | 'TokenOrRune'
    | 'WouldDie'
    | 'Scavenger'
    | 'Technician'
    | 'DiscardedCards'
    | 'Graveyard'
    | 'PutInHand'
    | 'ReturnToHeroZone'
    | 'BuildingDamage'
    | 'GameOver'
    | 'BuildingDestroyed'
    | 'CardToDestroy'
    | 'AttackComplete'
    | 'TowerDetected'
    | 'PossibleAttackTargets'
    | 'NoneChosen'
    | 'Info'
    | 'Ability'
    | 'Built'
    | 'Draw'
    | 'TowerReveal'
    | 'TokenAdded'
    | 'Boost'
    | 'PropAdjustment'
    | 'HeroMid'
    | 'HeroMax'
    | 'HeroGainLvl'
    | 'HeroDrain'
    | 'Patrol'
    | 'Sideline'
    | 'Healing';
export type RuneEvent = 'timeRunes' | 'damage' | 'plusOneOne' | 'minusOneOne' | 'featherRunes' | 'crumblingRunes';

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

        this.player1Board.base = new BoardBuilding('Base', this.player1Board);
        this.player1Board.base.build(true);
        this.player2Board.base = new BoardBuilding('Base', this.player2Board);
        this.player1Board.base.build(true);

        this.player1Board.tech1 = new TechBuilding('Tech 1', this.player1Board, 1);
        this.player1Board.tech2 = new TechBuilding('Tech 2', this.player1Board, 2);
        this.player1Board.tech3 = new TechBuilding('Tech 3', this.player1Board, 3);
        this.player1Board.addOn = new AddOn('AddOn', this.player1Board);

        this.player2Board.tech1 = new TechBuilding('Tech 1', this.player2Board, 1);
        this.player2Board.tech2 = new TechBuilding('Tech 2', this.player2Board, 2);
        this.player2Board.tech3 = new TechBuilding('Tech 3', this.player2Board, 3);
        this.player2Board.addOn = new AddOn('AddOn', this.player2Board);

        this.player1Board.heroZone = [new RiverMontoya(1)];

        this.player1Board.discard = [
            new BoostUnitTest(1),
            new TwoAbilitiesTest(1),
            new BoostUnitTest(1),
            new TwoAbilitiesTest(1),
            new BoostUnitTest(1),
            new TwoAbilitiesTest(1),
            new BoostUnitTest(1),
            new TwoAbilitiesTest(1),
            new BoostUnitTest(1),
            new TwoAbilitiesTest(1)
        ];

        this.player2Board.discard = [
            new TimelyMessenger(2),
            new TimelyMessenger(2),
            new TimelyMessenger(2),
            new TimelyMessenger(2),
            new TimelyMessenger(2),
            new TimelyMessenger(2),
            new TimelyMessenger(2),
            new TimelyMessenger(2),
            new TimelyMessenger(2),
            new TimelyMessenger(2)
        ];

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
        let cardsToDestroy: Card[] = this.getAllActiveCards().filter(card => {
            if (card && (card.cardType == 'Hero' || card.cardType == 'Unit') && card.shouldDestroy()) {
                results.push(new EventDescriptor('CardToDestroy', card.name + ' will be destroyed', { cardId: card.cardId }));
                return true;
            }
        });

        if (cardsToDestroy.length > 0) {
            let action = new Action('DestroyChoice');
            action.resolveNeededForCards(cardsToDestroy);
            this.phaseStack.addToStack(new Phase([action]));
        }

        return results;
    }

    processBoardState(board: Board): EventDescriptor[] {
        let results: EventDescriptor[] = [];

        // check base buildings. if base blown up, gg!
        let baseDestroyed = board.destroyIfRequired('Base');
        if (baseDestroyed) {
            this.phaseStack.topOfStack().gameOver = true;
            return baseDestroyed; // if the game is over, no need to figure everything else out. just end it
        }

        // check other buildings. if health is <= 0, destroy() and do damage to base
        let buildingsToCheck: BuildingType[] = <BuildingType[]>['Tech 1', 'Tech 2', 'Tech 3', 'AddOn'];

        for (let building in buildingsToCheck) {
            let bldgDestroyed = board.destroyIfRequired(<BuildingType>building);
            if (bldgDestroyed) results.push(...bldgDestroyed);
        }

        return results;
    }

    getBoardAndOpponentBoard(): Array<Board> {
        if (this.activePlayer == 1) {
            return [this.player1Board, this.player2Board];
        } else {
            return [this.player2Board, this.player1Board];
        }
    }

    addEvent(event: EventDescriptor): void {
        if (event) this.events.push(event);
    }

    addEvents(events: Array<EventDescriptor>): void {
        if (events && events.length > 0) this.events.push(...events);
    }

    /** Find a card, wherever it may be, and remove it from play. Card MUST be removed or this will throw an error */

    cardIsInAnActiveSpace(board: Board, card: Card): boolean {
        return (
            board
                .getPatrolZoneAsArray()
                .concat(...board.inPlay, board.activeSpells)
                .filter(localCard => localCard === card).length > 0
        );
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

    getAllActiveCards(useBoard?: Board): Card[] {
        if (useBoard) return useBoard.inPlay.concat(useBoard.getPatrolZoneAsArray(), useBoard.activeSpells);
        else
            return this.player1Board.inPlay.concat(
                this.player1Board.getPatrolZoneAsArray(),
                this.player1Board.activeSpells,
                this.player2Board.inPlay,
                this.player2Board.getPatrolZoneAsArray(),
                this.player2Board.activeSpells
            );
    }

    getAllPatrollers(useBoard?: Board): Card[] {
        if (useBoard) return useBoard.getPatrolZoneAsArray();
        else return this.player1Board.getPatrolZoneAsArray().concat(this.player2Board.getPatrolZoneAsArray());
    }

    getAllAttackableCards(space: Card[]): Card[] {
        return space.filter(card => {
            if (card.cardType != 'Hero' && card.cardType != 'Unit' && card.cardType != 'Building') return false;

            let attrs = card.effective();

            if ((attrs.invisible && !attrs.towerRevealedThisTurn) || attrs.unattackable) return false;

            return true;
        });
    }

    /**
     * Finds cards matching arbitary criteria, does a thing to those cards, and returns EventDescriptors describing what we did.
     *
     * @param cards search space
     * @param matching do something if this returns true
     * @param andDo what do
     */
    static findAndDoOnCards(
        space: Card[],
        matching: (card: Card) => boolean,
        andDo: (card: Card) => EventDescriptor
    ): Array<EventDescriptor> {
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

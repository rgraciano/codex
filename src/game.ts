


import 'reflect-metadata';

import { PhaseStack } from './phases/phase';

import { Board } from './board';

import { FruitNinja } from './cards/neutral/FruitNinja';
import { Tenderfoot } from './cards/neutral/Tenderfoot';
import { OlderBrother } from './cards/neutral/OlderBrother';
import { TimelyMessenger } from './cards/neutral/TimelyMessenger';

import { Card } from './cards/card';


export class Game {
    player1Board: Board;
    player2Board: Board;

    phaseStack: PhaseStack;

    activePlayer: number = 1;

    events: Array<EventDescriptor> = [];

    constructor() {
        this.player1Board = new Board(1);
        this.player2Board = new Board(2);

        // We will have to put in something to find starters etc later.  For now just give everyone the same bogus starter
        this.player1Board.discard = [new Tenderfoot(), new TimelyMessenger(), new OlderBrother(), 
            new FruitNinja(), new Tenderfoot(), new TimelyMessenger(),
            new OlderBrother(), new FruitNinja(), new Tenderfoot(), new TimelyMessenger()];

        this.player2Board.discard = [new Tenderfoot(), new TimelyMessenger(), new OlderBrother(), 
                new FruitNinja(), new Tenderfoot(), new TimelyMessenger(),
                new OlderBrother(), new FruitNinja(), new Tenderfoot(), new TimelyMessenger()];

        this.player1Board.drawCards(5);
        this.player2Board.drawCards(5);

        this.phaseStack = new PhaseStack();
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

    /** 
     * Searches an array of cards for every card mapping to an interface (eg, implements onUpkeep).
     * @param handlerFunction The function on an interface that would indicate this interface is implemented, eg, 'onUpkeep'
     * @param handlerEDFunction The Event Descriptor generator function on the interface, eg, UpkeepHandler.upkeepEventDescriptor
     * 
     * For example, findCardsWithHandlers(board.InPlay, 'onUpkeep', 'UpkeepChoices', 'upkeepText')
     */
    static findCardsWithHandlers(cards: Array<Card>, handlerFunction: string, handlerEDFunction: (card: Card) => EventDescriptor): Array<EventDescriptor> {
        return Game.findAndDoOnCards(cards, 
                                    (card: Card): boolean => {
                                        return Reflect.has(card, handlerFunction);
                                    },
                                    (card: Card): EventDescriptor => {
                                        return handlerEDFunction(card);
                                    });
    }
    
    static findAndDoOnCards(cards: Array<Card>, matching: (card: Card) => boolean, andDo: (card: Card) => EventDescriptor) : Array<EventDescriptor> {          
        let events: Array<EventDescriptor> = [];
        
        for (let card of cards) {
            if (matching(card)) {
                events.push(andDo(card));
            }
        }
    
        return events;
    }
}

/** Describes something that happened in the game, so the UI can tell the user later and perhaps do something visually  */
export class EventDescriptor {
    eventType: ServerEvent;

    initiatingCard: Card;
    impactedCards: Array<Card>;

    text: string;

    constructor(eventType: ServerEvent, text: string, initiatingCard?: Card, impactedCards?: Array<Card>) {
        this.eventType = eventType;
        this.text = text;

        if (initiatingCard)
            this.initiatingCard = initiatingCard;
        if (impactedCards) {
            this.impactedCards = impactedCards;
        }
    }
}
export type ServerEvent = 'ClearPatrolZone' | 'CollectGold' | 'ReadyCard' | 'UpkeepChoices';




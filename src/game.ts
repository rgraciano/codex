


import 'reflect-metadata';

import { PhaseStack } from './phases/phase';

import { Board } from './board';
import { PatrolZone } from './board';
import { Card } from './cards/card';
import { Trigger, EventDescriptor, ServerEvent } from './trigger';

import { FruitNinja } from './cards/neutral/FruitNinja';
import { Tenderfoot } from './cards/neutral/Tenderfoot';
import { OlderBrother } from './cards/neutral/OlderBrother';
import { TimelyMessenger } from './cards/neutral/TimelyMessenger';


export class Game {
    player1Board: Board;
    player2Board: Board;

    phaseStack: PhaseStack;

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

    findCardsWithHandlers(cards: Array<Card>, functionName: string): Array<Trigger> {
        return this.findAndDoOnCards(cards, 
                                    (card: Card): boolean => {
                                        return Reflect.has(card, functionName);
                                    },
                                    (card: Card): Trigger => {
                                        return new Trigger(new EventDescriptor('UpkeepChoices', card.name + ' has an upkeep trigger', card));
                                    });
    }

    findAndDoOnCards(cards: Array<Card>, matching: (card: Card) => boolean, andDo: (card: Card) => Trigger) : Array<Trigger> {          
        let events: Array<Trigger> = [];
        
        for (let card of cards) {
            if (matching(card)) {
                events.push(andDo(card));
            }
        }

        return events;
    }
}




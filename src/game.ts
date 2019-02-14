
import {anyid} from 'anyid';
import * as fs from 'fs';

import { Board } from './board';
import { PatrolZone } from './board';
import { Card } from './cards/cards';
import { Trigger } from './triggers';

import { FruitNinja } from './cards/neutral/FruitNinja';
import { Tenderfoot } from './cards/neutral/Tenderfoot';
import { OlderBrother } from './cards/neutral/OlderBrother';
import { TimelyMessenger } from './cards/neutral/TimelyMessenger';

export class Game {
    player1Board: Board;
    player2Board: Board;

    activeTriggers: Array<Trigger> = new Array();

    // Represents valid actions from the current game state
    validNextActions: Array<Phase>;

    // TODO: select specs and so on
    // Returns 
    initializeGame(): void {
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

        this.validNextActions = ['Player1TurnStart'];
    }

    startTurn(playerNumber: number): void {
        let board, opponentBoard;
        if (playerNumber == 1) {
            board = this.player1Board;
            opponentBoard = this.player2Board;
        }
        else {
            board = this.player2Board;
            opponentBoard = this.player1Board;
        }
    
        board.turnCount++;
        
        // clear patrol zone, moving everything to "in play"
        let patrolSlot: keyof PatrolZone;
        for (patrolSlot in board.patrolZone) {
            if (patrolSlot !== null) {
                board.inPlay.push(board.patrolZone[patrolSlot]);
                board.patrolZone[patrolSlot] = null;
            }
        }

        // READY PHASE
        // Nothing happens when we ready cards, so we don't have to worry about any triggers happening here.
        let andDoToReadyCards = function(activePlayerBoardCopy: Board, opponentBoardCopy: Board, card: Card): EventDescriptor {
            if (card.attributeModifiers.exhausted > 0)
                card.attributeModifiers.exhausted--; // decrement because adding to this means it's disabled or may have come into play exhausted
            
            card.attributeModifiers.arrivalFatigue = 0; // set to zero because you have arrival fatigue or you don't
            return new EventDescriptor('ReadyCard', "Readied " + card.name, card);
        };
        let matching = function(card: Card): boolean {
            let attrs = card.effective();
            return (attrs.exhausted > 0 || attrs.arrivalFatigue > 0);
        };
        this.findAndDoOnCards(board.inPlay, andDoToReadyCards, board, opponentBoard, matching);


        // TODO: tick off hero availability when heroes are implemented


        // upkeep (aka trigger central)
            // get gold, TODO: account for slow-time generator

            // build fading/forecast events; build onupkeep events; all mix together into one trigger list
            
    }


   // createListOfHandlers(cards: Array<Card>, interfaceName: string): Array<Trigger> {

   // }


    findAndDoOnCards(cards: Array<Card>, 
                            andDo: (activePlayerBoardCopy: Board, opponentBoardCopy: Board, card: Card) => EventDescriptor,
                            activePlayerBoardCopy: Board, opponentBoardCopy: Board, 
                            matching?: (card: Card) => boolean): Array<EventDescriptor> {
                        
        let events: Array<EventDescriptor> = [];
        
        for (let card of cards) {

            if ((!matching) || matching(card)) {
                let result = andDo(activePlayerBoardCopy, opponentBoardCopy, card);

                if (result) {
                    events.push(result);
                }
            }
        }

        return events;
    }
}


export class GameServer {
    game: Game;

    // Unique link to the current game state, can be passed around.  We encourage the user to pass this around at
    // beginning of turn, but technically you could pass it around whenever you want.  We also use this to branch 
    // (create multiple game states/outcomes) and avoid collisions.
    gameStateId: string;

    private generateGameStateId(): string {
        this.gameStateId = anyid().encode('Aa0').length(10).random().id();
        return this.gameStateId;
    }

    /** Creates a new game state ID for the current game state and saves it to the filesystem
     * TODO: Move this to something cloud-friendly; FS is fine for debugging
     */
    private saveGameState(): string {
        this.generateGameStateId();
        // TODO: error handling would be good
        fs.writeFileSync('e:\\saved_gamestates\\' + this.gameStateId + '.json', JSON.stringify(this.game));
        return this.gameStateId;
    }

    loadGameState(gameStateId: string) {
        this.game = JSON.parse(fs.readFileSync('e:\\saved_gamestates\\' + gameStateId + '.json', 'utf-8'));
    }

    /**
     * Creates a new game and new game state from square one.
     */
    createNewGame(): string {
        this.game = new Game();
        this.game.initializeGame();

        // Jump right into start turn, for player convenience
        return this.startTurn();
    }

    /**
     * Starts a player's turn and saves the game state.
     * @returns Game state ID
     */
    startTurn(): string {
        if (this.game.validNextActions.includes('Player1TurnStart')) {
            this.game.startTurn(1);
        }
        else if (this.game.validNextActions.includes('Player2TurnStart')) {
            this.game.startTurn(2);
        }
        else {
            throw "Valid actions are: " + this.game.validNextActions.toString;
        }

        return this.saveGameState();
    }
}
type Phase = 'Player1TurnStart' | 'Player2TurnStart' | 'NewGame' | 'AttackSetup' | 'AttackDeal' | 'AttackDealCleanup' | 'AttackOverpower' | 'AttackCleanup'; 


/** Describes something that happened in the game, so the UI can tell the user later and perhaps do something visually  */
class EventDescriptor {
    eventType: ServerEvent;

    initiatingCard: Card;
    impactedCards: Array<Card>;

    text: string;

    constructor(eventType: ServerEvent, text: string, initiatingCard: Card, impactedCards?: Array<Card>) {
        this.eventType = eventType;
        this.text = text;
        this.initiatingCard = initiatingCard;
    }
}
type ServerEvent = 'ReadyCard';


// Actions are events in the game that can spawn triggers, like upkeep, attack, patrol, etc.
// This could work like -
//     1) Client chooses to perform an action.  Client asks the server for valid targets for
//     that action and so on.  Server returns all of that stuff.
//     2) Client then chooses to do a thing and the server enters an Action routine for the current
//     board state.  It will then start creating triggers, stopping when it needs the user to make a choice
//     or when something can't be unwound.
//     3) Server returns the list of triggers to the client and prompts the client to choose targets for any triggers requiring them.  
//     Server validates / saves those choices and continues building the trigger list, repeating this process as necessary. 
//     4) Client submits its choices; server runs same routine, but this time runs everything at the end according to the user's choices.
//     5) Repeat until action is done, print out board state.
//
// Note we only prompt the user if: 1) for triggers, there's more than one choice (could be zero or one); 2) the game has figured out that re-ordering
// triggers produces a different outcome (Board state)

// Starting to model a server state...

function attack(attackingBoard: Board, defendingBoard: Board, attacker: Card, defender: Card) {
    // first process onAttack triggers; these can be re-ordered
    // re-ordering stops here

    // game state check & trigger loop

    // next process damage, process any onDamage triggers (do these exist?)
    // no re-ordering possible (i think...)

    // check game state & trigger loop

    // process sparkshot, overpower if something died; process onDamage triggers on those targets if this is a thing
    
    // check game state & trigger loop
}

import {anyid} from 'anyid';
import * as fs from 'fs';

import { Board } from './board';
import { Card } from './cards/cards';
import { Trigger } from './triggers';

import { FruitNinja } from './cards/neutral/FruitNinja';
import { Tenderfoot } from './cards/neutral/Tenderfoot';
import { OlderBrother } from './cards/neutral/OlderBrother';
import { TimelyMessenger } from './cards/neutral/TimelyMessenger';

export class Game {
    public player1Board: Board;
    public player2Board: Board;

    public activeTriggers: Array<Trigger> = new Array();

    // Represents valid actions from the current game state
    public validNextActions: Array<Phase>;

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
        let board = playerNumber == 1 ? this.player1Board : this.player2Board;
        board.turnCount++;
        
        // ready

        // upkeep
            // get gold
            // build fading/forecast events; build onupkeep events; all mix together into one trigger list
            // tick off hero availability if dead
    }
}


export class GameServer {
    public game: Game;

    // Unique link to the current game state, can be passed around.  We encourage the user to pass this around at
    // beginning of turn, but technically you could pass it around whenever you want.  We also use this to branch 
    // (create multiple game states/outcomes) and avoid collisions.
    public gameStateId: string;

    private generateGameStateId(): string {
        this.gameStateId = anyid().encode('Aa0').length(10).random().id();
        return this.gameStateId;
    }

    /** Creates a new game state ID for the current game state and saves it to the filesystem
     * TODO: Move this to something cloud-friendly; FS is fine for debugging
     */
    private saveGameState(): void {
        this.generateGameStateId();
        // TODO: error handling would be good
        fs.writeFileSync('../saved_gamestates/' + this.gameStateId + '.json', JSON.stringify(this.game));
    }

    public loadGameState(gameStateId: string) {
        this.game = JSON.parse(fs.readFileSync('../saved_gamestates/' + gameStateId + '.json', 'utf-8'));
    }

    /**
     * Creates a new game and new game state from square one.
     */
    createNewGame(): void {
        this.game = new Game();
        this.game.initializeGame();

        // Jump right into start turn, for player convenience
        this.startTurn();
        this.saveGameState();
    }

    /**
     * 
     */
    startTurn(): void {
        if (this.game.validNextActions.includes('Player1TurnStart')) {
            this.game.startTurn(1);
        }
        else if (this.game.validNextActions.includes('Player2TurnStart')) {
            this.game.startTurn(2);
        }
        else {
            throw "Valid actions are: " + this.game.validNextActions.toString;
        }

        console.log(this.game.player1Board);
    }
}
type Phase = 'Player1TurnStart' | 'Player2TurnStart' | 'NewGame' | 'AttackSetup' | 'AttackDeal' | 'AttackDealCleanup' | 'AttackOverpower' | 'AttackCleanup'; 


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
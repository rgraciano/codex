
import { Game } from './game';
import { anyid } from 'anyid';
import * as fs from 'fs';
import { Phase, ActionName } from './phases/phase';
import { startTurnAction, upkeepChoiceAction } from './phases/start_turn';
import { playCardAction, arriveChoiceAction } from './phases/play_card';

/*
Here's how the game server works:

The game is asynchronous and turn-based.  Every time something happens, the server creates a new game state, saves it to storage,
and returns an ID.

The user makes one of two types of requests, either:
    1) Begin game
    2) An "Action" and a game state ID

If Begin Game, the game creates a new state and returns the ID to the user.  All requests from herein out will look like #2 (action and state ID).

The game state is structured into "Phases" which each have a set of corresponding "Actions".  Whenever a user sends an Action and a State ID, we do these things:
 
1) Load the game state
2) Check the top of the Phase stack.  Check that the action the player wants is in this Phase's list of possible actions. If valid, route to the correct action.
3) The action may complete without requiring much, OR it may require more from the user.
    - If the action requires more from the user, it creates a new PHASE and sets the possible actions on the new phase to indicate what we need from the user.
        - The possible actions for a trigger will be all of the cards that need to resolved to finish resolving that trigger.
        - This new Phase is then added to the top of the stack of available phases.
        - This process may continue to repeat, and more and more nesting may occur.
    - If the action is a trigger and a Card Id, we resolve that trigger and cross the card off the list.
4) Game state is saved.
5) A response is sent to the user telling them what happened.
*/
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
        // this is going to need to create objects. maybe https://github.com/typestack/class-transformer ?
        // i'm thinking likely best thing to do would be to separate data and behavior as much as possible so it's not as much of an issue
        this.game = JSON.parse(fs.readFileSync('e:\\saved_gamestates\\' + gameStateId + '.json', 'utf-8'));
    }

    // TODO: likely to replace the skeleton with some framework here...
    action(action: ActionName, context: StringMap): string {
        if (action == 'NewGame') {
            this.game = new Game();
            this.game.setupNewGame();
            startTurnAction(this.game);

            this.saveGameState();
            return this.responseSuccess();
        }
        
        let state: (string | boolean) = GameServer.getAlNumProperty(context, 'state');
        
        if (!state) {
            return this.responseError('No state specified');
        }

        state = <string>state; // asserting that this is definitely a string now..

        this.loadGameState(state);

        if (!this.game.phaseStack.topOfStack().isValidAction(action)) {
            return this.responseError('Action ' + action + ' is not currently valid.  Currently valid actions include ' + this.game.phaseStack.validActions().toString);
        }
   
        try {
            let props: StringMap;
            switch (action) {
                case 'UpkeepChoice':
                    props = GameServer.requiredAlnumProperties(context, ['cardId']);
                    upkeepChoiceAction(this.game, props['cardId']);
                    break;
                case 'PlayCard':
                    props = GameServer.requiredAlnumProperties(context, ['cardId']);
                    playCardAction(this.game, props['cardId']);
                    break;
                case 'ArriveChoice':
                    props = GameServer.requiredAlnumProperties(context, ['cardId']);
                    arriveChoiceAction(this.game, props['cardId']);
                    break;
                default:
                    this.responseError('Invalid action');
            }

            this.saveGameState();
            return this.responseSuccess();
        } catch (e) {
            return this.responseError(e.message);
        }
    }

    responseError(error: string) {
        return JSON.stringify( { error: error } );
    }

    responseSuccess() {
        // TODO: This should turn into a game state sweep. Check dead things, check game end, etc.
        this.game.phaseStack.resolveEmptyPhases();
        let topOfStack: Phase = this.game.phaseStack.topOfStack();

        return JSON.stringify( { 
            state: this.gameStateId,
            events: this.game.events,
            validActions: topOfStack.validActions,  
            mustResolveIds: topOfStack.mustResolveIds,
            player1Board: this.game.player1Board,
            player2Board: this.game.player2Board
        } );
    }
        /*
game flow then...

phase: new game (isapi)
	- valid actions: pick specs etc
phase: player1turnstart
	- if turn 1, dont tech obv
	- upkeep autohappens
		- if upkeep triggers, begin phase upkeep_triggers. valid actions: choose upkeep
			(keep nesting)
		- leave upkeep phase when valid actions are gone
	- valid actions: attack, patrol, ability, etc. also END TURN is a valid action.
    - draw/discard, end turn trigger nest
*/

    static requiredAlnumProperties(context: StringMap, requiredList: Array<string>): StringMap {
        let validated: StringMap = new StringMap();

        for (let req of requiredList) {
            if (context.hasOwnProperty(req) && !( /[^a-zA-Z0-9]/.test(context[req]) )) {
                validated[req] = context[req];
            }
            else {
                throw new Error('Missing parameter: ' + req); // TODO: this doesn't map to error handling elsewhere, but it's easy to manage...
            }
        }

        return validated;
    }

    // TODO: Replace later; will pick some kind of framework that does this boilerplate stuff for us
    static getAlNumProperty(context: StringMap, property: string): (string | boolean) {
        if (context.hasOwnProperty(property) && !( /[^a-zA-Z0-9]/.test(context[property]) )) {
            return context[property];
        }
        return false;
    }
}
export class StringMap { [s: string]: string; }

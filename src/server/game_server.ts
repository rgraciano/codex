
import { Game } from './game';
import { anyid } from 'anyid';
import * as fs from 'fs';
import { ActionName } from './actions/phase';
import { startTurnAction } from './actions/start_turn';
import { playCardAction } from './actions/play_card';
import { choiceAction } from './actions/choice';
import { attackAction, prepareAttackTargetsAction } from './actions/attack';

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
    private saveGameState(stringifiedGameState: string): string {
        this.generateGameStateId();
        // TODO: error handling would be good
        fs.writeFileSync('e:\\saved_gamestates\\' + this.gameStateId + '.json', stringifiedGameState);
        return this.gameStateId;
    }

    loadGameState(gameStateId: string) {
        let path = 'e:\\saved_gamestates\\' + gameStateId + '.json';
        if (fs.existsSync(path))
            this.game = Game.deserialize(JSON.parse(fs.readFileSync(path, 'utf-8')));
        else
            throw new Error('Game state ' + gameStateId + ' does not exist');
    }

    // TODO: likely to replace the skeleton with some framework here...
    action(action: ActionName, context: StringMap): string {
        if (action == 'NewGame') {
            this.game = new Game();
            this.game.setupNewGame();
            startTurnAction(this.game);

            return this.wrapUp();
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
            let cardId = GameServer.requiredAlnumProperties(context, ['cardId'])['cardId'];
            this.runAction(action, cardId, context);
            return this.wrapUp();
        } catch (e) {
            return this.responseError(e.message);
        }
    }

    runAction(action: string, cardId: string, context: StringMap) {
        if (action.endsWith('Choice')) {
            let safeContext: StringMap = {};

            if (action == 'AttackCardsOrBuildingsChoice') {
                let buildingChoice = GameServer.getAlNumProperty(context, 'building');
                let cardChoice = GameServer.getAlNumProperty(context, 'validCardTargetId');
                
                if (buildingChoice) safeContext.building = buildingChoice;
                else if (cardChoice) safeContext.validCardTargetId = cardChoice;
            }
            else if (action == 'AttackCardsChoice') {
                safeContext.validCardTargetId = GameServer.requiredAlnumProperties(context, [ 'validCardTargetId' ])['validCardTargetId'];
            }
            choiceAction(this.game, cardId, <ActionName>action, safeContext);
        }
        else switch(action) {
            case 'PlayCard':
                playCardAction(this.game, cardId);
                break;
            case 'Attack':
                attackAction(cardId);
                break;
            case 'PrepareAttackTargets':
                prepareAttackTargetsAction(cardId);
                break;
            default:
                this.responseError('Invalid action');
        }
    }

    responseError(error: string) {
        return JSON.stringify( { error: error } );
    }

    wrapUp(): string {
        this.cleanUpPhases();
        return this.responseSuccess();
    }
    
    /**
    * Before the end of this action, clear as many actions as the game can clear without user input.
    * 
    * First, eliminate any empty phases - phases that don't have any cards on them to take action on.
    * Second, eliminate any phases with only a single valid action, by performing that action.
    * 
    * Each time we eliminate one of the above, we keep going to clear as many as we can.
    */
    cleanUpPhases() {
        let clearedEmptyPhase: boolean, clearedSingleAction: boolean;

        do {
            clearedEmptyPhase = this.game.phaseStack.resolveEmptyPhases();

            // Must happen after we clear empty phases, because GameOver is an empty phase
            this.game.addEvents(this.game.processGameState(this.game.player1Board));
            this.game.addEvents(this.game.processGameState(this.game.player2Board));

            // If there's only one action that can be performed, and the game knows how to perform that action, then we do it automatically now before
            // returning to the user.  'PlayerChoice' indicates that the player MUST do something.
            let topOfStack = this.game.phaseStack.topOfStack();
            
            if (topOfStack.name == 'GameOver')
                return;

            if (topOfStack.name != 'PlayerPrompt' && topOfStack.validActions.length === 1 && topOfStack.mustResolveMaps.length === 1) {
                this.runAction(topOfStack.validActions[0], <string>topOfStack.mustResolveMaps[0]['resolveId'], {});
                clearedSingleAction = true;
            }
            else 
                clearedSingleAction = false;
        } while(clearedEmptyPhase || clearedSingleAction);
    }

    responseSuccess(): string {
        let stringifiedGameState = JSON.stringify(this.game.serialize());
        this.saveGameState(stringifiedGameState);
        return stringifiedGameState;
    }

    static requiredAlnumProperties(context: StringMap, requiredList: Array<string>): StringMap {
        let validated: StringMap = new StringMap();

        for (let req of requiredList) {
            if (context.hasOwnProperty(req) && !( /[^a-zA-Z0-9]/.test(context[req]) )) {
                validated[req] = context[req];
            }
            else throw new Error('Missing parameter: ' + req); // TODO: this doesn't map to error handling elsewhere, but it's easy to manage...
        }

        return validated;
    }

    // TODO: Replace later; will pick some kind of framework that does this boilerplate stuff for us
    static getAlNumProperty(context: StringMap, property: string): (string | false) {
        if (context.hasOwnProperty(property) && !( /[^a-zA-Z0-9]/.test(context[property]) )) {
            return context[property];
        }
        return false;
    }
}
export class StringMap { [s: string]: string; }
export class ObjectMap { [s: string]: Object; }


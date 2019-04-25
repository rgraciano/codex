import { Game } from './game';
import { anyid } from 'anyid';
import * as fs from 'fs';
import { startTurnAction } from './actions/start_turn_action';
import { ActionName } from './actions/phase';
import { playCardAction } from './actions/play_card_action';
import { choiceAction, ChoiceCategory } from './actions/choice_actions';
import { attackAction, prepareAttackTargetsAction } from './actions/attack_actions';
import { abilityAction } from './actions/ability_action';
import { buildAction } from './actions/build_action';
import { AddOnType, Board } from './board';
import { towerRevealAction } from './actions/tower_reveal_action';
import { playStagingAbilityAction } from './actions/play_staging_ability_action';
import { patrolAction, sidelineAction } from './actions/patrol_action';
import { heroLevelAction } from './actions/hero_level_action';
import { endTurnAction, endTurnCleanupAction } from './actions/end_turn';

const savePath = '/Users/rg/gamestates';

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
        - The possible actions for a trigger will be one (the trigger action), and it will be marked with all of the cards that need to resolve to finish resolving that trigger.
        - This new Phase is then added to the top of the stack of available phases.
        - This process may continue to repeat, and more and more nesting may occur.
    - If the action is a trigger and a Card Id, we resolve that trigger and cross the card off the list.
4) Game state is saved.
5) A response is sent to the client representing the new game state, along with a list of human-readable event descriptions to communicate what happened.
*/
export class GameServer {
    game: Game;

    // Unique link to the current game state, can be passed around.  We encourage the user to pass this around at
    // beginning of turn, but technically you could pass it around whenever you want.  We also use this to branch
    // (create multiple game states/outcomes) and avoid collisions.

    private generateGameStateId(): string {
        return anyid()
            .encode('Aa0')
            .length(10)
            .random()
            .id();
    }

    /** Creates a new game state ID for the current game state and saves it to the filesystem
     * TODO: Move this to something cloud-friendly; FS is fine for debugging
     */
    private saveGameState(gameStateId: string, serializedState: ObjectMap) {
        // TODO: error handling would be good
        fs.writeFileSync(savePath + '/' + gameStateId + '.json', JSON.stringify(serializedState));
    }

    loadGameState(gameStateId: string) {
        let path = savePath + '/' + gameStateId + '.json';
        if (fs.existsSync(path)) this.game = Game.deserialize(JSON.parse(fs.readFileSync(path, 'utf-8')));
        else throw new Error('Game state ' + gameStateId + ' does not exist');
    }

    // TODO: likely to replace the skeleton with some framework here...
    action(action: ActionName, context: StringMap): ObjectMap {
        if (action == 'NewGame') {
            this.game = new Game();
            this.game.setupNewGame();
            startTurnAction(this.game);

            return this.wrapUp();
        }

        let state: string | boolean = GameServer.getAlNumProperty(context, 'gameStateId');

        if (!state) {
            return this.responseError('No state specified');
        }

        state = <string>state; // asserting that this is definitely a string now..

        this.loadGameState(state);

        if (!this.game.phaseStack.topOfStack().isValidAction(action)) {
            return this.responseError('Action ' + action + ' is not currently valid');
        }

        try {
            this.runAction(action, context);
            return this.wrapUp();
        } catch (e) {
            return this.responseError(e.message);
        }
    }

    static requireProp(
        propname: string,
        context: StringMap,
        validFn: (strmap: StringMap, reqlist: string[]) => StringMap,
        overrideId?: string
    ): string {
        if (overrideId) return overrideId;

        let propValue = validFn(context, [propname])[propname];
        if (!propValue) throw new Error('Required property ' + propname + ' could not be found');

        return propValue;
    }

    runAction(actionName: ActionName, context: StringMap, overrideWithPhase: boolean = false) {
        let onlyPossibleTarget: string = undefined;
        let phase = this.game.phaseStack.topOfStack();
        let action = phase.getAction(actionName);
        if (!action) throw new Error('Invalid action');

        if (overrideWithPhase) onlyPossibleTarget = <string>phase.actions[0].onlyPossibleId;

        if (actionName.endsWith('Choice')) {
            let safeContext: StringMap = {};
            let choiceValue: string;
            let choiceCategory: ChoiceCategory = 'Card';

            let buildingChoice = GameServer.getAlNumProperty(context, 'buildingId');
            let cardChoice = GameServer.getAlNumProperty(context, 'cardId');

            // Default to buildingId or cardId, whichever is set
            if (buildingChoice) {
                choiceCategory = 'Building';
                choiceValue = buildingChoice;
            } else if (cardChoice) {
                choiceCategory = 'Card';
                choiceValue = cardChoice;
            }

            // when attacking, if there's an "only possible choice" then it's a target building or target attack,
            // and we have to get the attacking card ID from the extra state
            if (actionName == 'DefenderChoice' && overrideWithPhase && Board.isBuildingId(onlyPossibleTarget)) {
                choiceCategory = 'Building';
                choiceValue = onlyPossibleTarget;
            } else if (actionName == 'PatrolChoice') {
                choiceCategory = 'Arbitrary';
                choiceValue = GameServer.requireProp('patrolSlot', context, GameServer.alnumProperties);
            } else if (actionName == 'HeroLevelChoice' && !choiceValue && !onlyPossibleTarget) {
                choiceCategory = 'Arbitrary';
            }
            // when not attacking, the only possible choice is simple
            else if (overrideWithPhase) {
                choiceCategory = 'Card';
                choiceValue = onlyPossibleTarget;
            }

            choiceAction(this.game, action, choiceValue, choiceCategory, safeContext);

            return;
        }

        switch (actionName) {
            case 'Ability': {
                let cardId = GameServer.requireProp('cardId', context, GameServer.alnumProperties); // no onlyPossibleTarget possible
                abilityAction(cardId, GameServer.requireProp('abilityName', context, GameServer.nameProperties));
                break;
            }

            case 'Attack': {
                let cardId = GameServer.requireProp('cardId', context, GameServer.alnumProperties); // no onlyPossibleTarget possible
                attackAction(cardId);
                break;
            }

            case 'Build': {
                let buildingId = GameServer.requireProp('buildingId', context, GameServer.nameProperties); // no onlyPossibleTarget possible

                let addOnType = undefined;
                if (buildingId == 'AddOn') addOnType = GameServer.requireProp('addOnType', context, GameServer.nameProperties);

                buildAction(this.game, buildingId, <AddOnType>addOnType);
                break;
            }

            case 'EndTurn': {
                endTurnAction(this.game);
                break;
            }

            case 'EndTurnCleanup': {
                endTurnCleanupAction(this.game);
                break;
            }

            case 'HeroLevel': {
                let cardId = GameServer.requireProp('cardId', context, GameServer.alnumProperties);
                heroLevelAction(cardId);
                break;
            }

            case 'Patrol': {
                let cardId = GameServer.requireProp('cardId', context, GameServer.alnumProperties);
                patrolAction(cardId);
                break;
            }

            case 'PlayCard': {
                let cardId = GameServer.requireProp('cardId', context, GameServer.alnumProperties); // no onlyPossibleTarget possible
                playCardAction(cardId);
                break;
            }

            case 'PrepareAttackTargets': {
                let cardId = GameServer.requireProp('cardId', context, GameServer.alnumProperties, onlyPossibleTarget);
                prepareAttackTargetsAction(cardId);
                break;
            }

            case 'Sideline': {
                let cardId = GameServer.requireProp('cardId', context, GameServer.alnumProperties);
                sidelineAction(cardId);
                break;
            }

            case 'StagingAbility': {
                playStagingAbilityAction(
                    this.game,
                    GameServer.requireProp('cardId', context, GameServer.alnumProperties),
                    GameServer.requireProp('abilityName', context, GameServer.nameProperties)
                );
                break;
            }

            case 'TowerReveal': {
                towerRevealAction(this.game);
                break;
            }

            case 'Worker': {
                let cardId = GameServer.requireProp('cardId', context, GameServer.alnumProperties); // no onlyPossibleTarget possible
                playCardAction(cardId, true);
                break;
            }

            default:
                this.responseError('Invalid action');
        }
    }

    responseError(error: string) {
        return { error: error };
    }

    wrapUp(): ObjectMap {
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

            this.game.addEvents(this.game.processGameState());

            // If there's only one action that can be performed, and the game knows how to perform that action, then we do it automatically now before
            // returning to the user.  'PlayerChoice' indicates that the player MUST do something.
            let topOfStack = this.game.phaseStack.topOfStack();

            if (topOfStack.gameOver) return;

            if (topOfStack.actions.length === 1 && topOfStack.actions[0].canAutoResolve) {
                this.runAction(topOfStack.actions[0].name, {}, true);
                clearedSingleAction = true;
            } else clearedSingleAction = false;
        } while (clearedEmptyPhase || clearedSingleAction);
    }

    responseSuccess(): ObjectMap {
        this.game.gameStateId = this.generateGameStateId();
        let serialized = this.game.serialize();
        this.saveGameState(this.game.gameStateId, serialized);
        return serialized;
    }

    static validateProperties(context: StringMap, requiredList: string[], regEx: RegExp): StringMap {
        let validated: StringMap = new StringMap();

        for (let req of requiredList) {
            if (context.hasOwnProperty(req) && !regEx.test(context[req]) && context[req].length < 50) {
                validated[req] = context[req];
            } else {
                validated[req] = '';
            }
        }

        return validated;
    }

    static alnumProperties(context: StringMap, requiredList: string[]): StringMap {
        return GameServer.validateProperties(context, requiredList, /[^a-zA-Z0-9]/);
    }

    static nameProperties(context: StringMap, requiredList: string[]): StringMap {
        return GameServer.validateProperties(context, requiredList, /[^- +\/\\a-zA-Z0-9]/);
    }

    // TODO: Replace later; will pick some kind of framework that does this boilerplate stuff for us
    static getAlNumProperty(context: StringMap, property: string): string | false {
        if (context.hasOwnProperty(property) && !/[^a-zA-Z0-9]/.test(context[property])) {
            return context[property];
        }
        return false;
    }
}
export class StringMap {
    [s: string]: string;
}
export class ObjectMap {
    [s: string]: Object;
}

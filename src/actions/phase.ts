import { Card } from '../cards/card';
import { ObjectMap, StringMap } from '../game_server';

// Phase names have no meaning to the client. They could actually be empty or removed altogether,
// but naming the phases makes it a little easier to debug the stack and follow what's going on.
// The game server does use phase names a little, primarily to figure out how many actions it should
// currently be seeing and whether or not it can auto-resolve this phase.
export type PhaseName =
    | 'PlayerTurn'
    | 'NewGame'
    | 'Upkeep'
    | 'Arrives'
    | 'Dies'
    | 'PlayerPrompt'
    | 'GameOver'
    | 'Destroy'
    | 'Attack'
    | 'PrepareAttackTargets'
    | 'AttackDestination'
    | 'ChooseAbilityTarget'
    | 'ChooseTowerReveal'
    | 'Staging'
    | 'ChoosePatrolSlot';

// The client uses Actions to understand what API calls are currently valid, and how to present possible actions to the user.
export type ActionName =
    | 'NewGame'
    | 'StagingAbility'
    | 'UpkeepChoice'
    | 'ArrivesChoice'
    | 'DiesChoice'
    | 'LeavesChoice'
    | 'HeroLevelChoice'
    | 'DestroyChoice'
    | 'AttacksChoice'
    | 'PrepareAttackTargets'
    | 'AttackCardsChoice'
    | 'AttackCardsOrBuildingsChoice'
    | 'AbilityChoice'
    | 'TowerRevealChoice'
    | 'PatrolChoice'
    | TurnActionName;

export type TurnActionName =
    | 'PlayCard'
    | 'Worker'
    | 'Tech'
    | 'Build'
    | 'Patrol'
    | 'Ability'
    | 'Attack'
    | 'HeroLevel'
    | 'EndTurn'
    | 'TowerReveal'
    | 'Sideline';

// note patrol and un-patrol will BOTH need to be options, or attack/ability/exhaust will need to check if patrolling and
// remove from that state

/**
 * Phases are parts of the game that allow a set of actions to be performed in any order.  Some actions
 * may be performed multiple times.  Others can only be performed once and have to be crossed off the list.
 *
 * An action in a phase may spawn a new phase, with a new set of available actions (and on, and on...).  When
 * a phase is done, we resolve it and go back to the phase that initiated it.
 *
 * We represent phases as a stack, checking that actions in the current phase are possible
 */
export class PhaseStack {
    stack: Phase[] = [];

    setupForNewGame() {
        this.stack = [new Phase('NewGame', [], false)];
    }

    serialize(): ObjectMap {
        return { stack: this.stack.map(phase => phase.serialize()) };
    }

    static deserialize(pojo: ObjectMap): PhaseStack {
        let ps = new PhaseStack();
        ps.stack = (<ObjectMap[]>pojo.stack).map(phase => Phase.deserialize(phase));
        return ps;
    }

    addToStack(newTop: Phase): void {
        this.stack.push(newTop);
    }

    topOfStack(): Phase {
        return this.stack[this.stack.length - 1];
    }

    /** This will clear out any phases that are no longer valid because they have cleared out all required cards.
     * Cards may have died due to effects or simply been resolved.
     * @returns true if phases were eliminated, false if not */
    resolveEmptyPhases(): boolean {
        let beginLen = this.stack.length;

        this.stack = this.stack.filter(phase => {
            // keep actions that havent yet been resolved
            // note if mandatoryChoices is zero, then this action is always going to be valid
            phase.actions = phase.actions.filter(action => action.resolvedIds.length < action.mandatoryChoices);

            // if all actions have been resolved, exit this phase
            if (phase.resolvesOnEmpty && phase.actions.length == 0) return false;
            else return !phase.endThisPhase;
        });

        let endLen = this.stack.length;

        return beginLen != endLen;
    }

    endCurrentPhase(): void {
        this.stack.pop();
    }
}

export class Action {
    name: ActionName;
    mandatoryChoices: number = 1;
    idsToResolve: string[] = [];
    resolvedIds: string[] = [];

    constructor(name: ActionName, mandatoryChoices = 1) {
        this.name = name;
        this.mandatoryChoices = mandatoryChoices;
    }

    serialize(): ObjectMap {
        return {
            name: this.name,
            idsToResolve: this.idsToResolve,
            resolvedIds: this.resolvedIds,
            mandatoryChoices: this.mandatoryChoices
        };
    }

    static deserialize(pojo: ObjectMap): Action {
        let action = new Action(<ActionName>pojo.name, <number>pojo.mandatoryChoices);
        action.idsToResolve = <string[]>pojo.idsToResolve;
        action.resolvedIds = <string[]>pojo.resolvedIds;
        return action;
    }

    resolveCards(cards: Card[]): void {
        cards.map(card => this.resolveId(card.cardId));
    }

    /** @ids could be card IDs OR BuildingTypes */
    resolveIds(ids: string[]): void {
        ids.map(id => this.resolveId(id));
    }

    resolveId(id: string) {
        this.resolvedIds.push(id);

        let index = this.idsToResolve.findIndex(thisId => thisId === id);
        if (index > -1) {
            this.idsToResolve.splice(index, 1);
        }
    }

    /** @returns whether or not card can be found in list of must resolved */
    ifToResolve(cardId: string): boolean {
        return this.idsToResolve.filter(thisId => thisId === cardId).length > 0;
    }
}

export class Phase {
    actions: Action[] = [];

    resolvesOnEmpty: boolean = true;
    endThisPhase: boolean = false;

    // In some cases, we may do different things based on which ID is selected.
    // If necessary, we record the thing to do for each ID here.
    actionsForIds: StringMap = {};

    // This is used to track any information an action needs to carry forward in this phase,
    // e.g., which attacker we're currently resolving.
    extraState: PrimitiveMap = {};

    constructor(name: PhaseName, actions: Action[], resolvesOnEmpty: boolean = true) {
        this.name = name;
        this.actions = actions;
        this.resolvesOnEmpty = resolvesOnEmpty;
    }

    serialize(): ObjectMap {
        return {
            name: this.name,
            actions: this.actions.map(action => action.serialize()),
            actionsForIds: this.actionsForIds,
            extraState: this.extraState,
            resolvesOnEmpty: this.resolvesOnEmpty
        };
    }

    static deserialize(pojo: ObjectMap): Phase {
        let actions = (<ObjectMap[]>pojo.actions).map(action => Action.deserialize(action));
        let phase = new Phase(<PhaseName>pojo.name, actions);
        phase.actionsForIds = <StringMap>pojo.actionsForIds;
        phase.extraState = <PrimitiveMap>pojo.extraState;
        phase.resolvesOnEmpty = <boolean>pojo.resolvesOnEmpty;
        return phase;
    }

    getAction(actionName: ActionName): Action {
        return this.actions.find((action: Action) => action.name == actionName);
    }

    isValidAction(action: ActionName): boolean {
        return this.actions.find((curAction: Action) => curAction.name == action) !== undefined;
    }
}

export type PrimitiveMap = {
    [k: string]: string | number | boolean;
};

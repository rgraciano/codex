import { Card } from '../cards/card';
import { ObjectMap, StringMap } from '../game_server';

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
        this.stack = [new Phase([], false)];
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
            // first, if we've chosen everything possible, then we clear the action
            phase.actions = phase.actions.filter(action => action.resolvedIds.length < action.idsToResolve.length);

            // next, if we've chosen the correct number already, clear the action
            phase.actions = phase.actions.filter(
                action => !action.mustChooseAll && action.mandatoryChoices > 0 && action.mandatoryChoices < action.resolveIds.length
            );

            // if all actions have been resolved, or if we are marked with "end this phase", exit this phase
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
    mustChooseAll: boolean = false;
    idsToResolve: string[] = [];
    resolvedIds: string[] = [];

    constructor(name: ActionName, mandatoryChoices = 1, mustChooseAll = false) {
        this.name = name;
        this.mandatoryChoices = mandatoryChoices;
        this.mustChooseAll = mustChooseAll;
    }

    serialize(): ObjectMap {
        return {
            name: this.name,
            idsToResolve: this.idsToResolve,
            resolvedIds: this.resolvedIds,
            mandatoryChoices: this.mandatoryChoices,
            mustChooseAll: this.mustChooseAll
        };
    }

    static deserialize(pojo: ObjectMap): Action {
        let action = new Action(<ActionName>pojo.name, <number>pojo.mandatoryChoices, <boolean>pojo.mustChooseAll);
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

    constructor(actions: Action[], resolvesOnEmpty: boolean = true) {
        this.actions = actions;
        this.resolvesOnEmpty = resolvesOnEmpty;
    }

    serialize(): ObjectMap {
        return {
            actions: this.actions.map(action => action.serialize()),
            actionsForIds: this.actionsForIds,
            extraState: this.extraState,
            resolvesOnEmpty: this.resolvesOnEmpty
        };
    }

    static deserialize(pojo: ObjectMap): Phase {
        let actions = (<ObjectMap[]>pojo.actions).map(action => Action.deserialize(action));
        let phase = new Phase(actions);
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

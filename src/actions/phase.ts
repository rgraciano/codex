import { Card } from '../cards/card';
import { ObjectMap, StringMap } from '../game_server';

// The client uses Actions to understand what API calls are currently valid, and how to present possible actions to the user.
export type ActionName =
    | 'NewGame'
    | 'LoadState'
    | 'StagingAbility'
    | 'UpkeepChoice'
    | 'ArrivesChoice'
    | 'DiesChoice'
    | 'LeavesChoice'
    | 'HeroLevelChoice'
    | 'DestroyChoice'
    | 'AttacksChoice'
    | 'PrepareAttackTargets'
    | 'DefenderChoice'
    | 'AbilityChoice'
    | 'TowerRevealChoice'
    | 'PatrolChoice'
    | 'Overpower'
    | 'EndTurnChoice'
    | 'EndTurnCleanup'
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
        this.addToStack(
            new Phase([
                new Action('PlayCard', new ActionOptions()).registerNeverAutoResolve(),
                new Action('Worker', new ActionOptions()).registerNeverAutoResolve(),
                new Action('Tech', new ActionOptions()).registerNeverAutoResolve(),
                new Action('Build', new ActionOptions()).registerNeverAutoResolve(),
                new Action('Patrol', new ActionOptions()).registerNeverAutoResolve(),
                new Action('Ability', new ActionOptions()).registerNeverAutoResolve(),
                new Action('Attack', new ActionOptions()).registerNeverAutoResolve(),
                new Action('HeroLevel', new ActionOptions()).registerNeverAutoResolve(),
                new Action('EndTurn', new ActionOptions()).registerNeverAutoResolve(),
                new Action('TowerReveal', new ActionOptions()).registerNeverAutoResolve(),
                new Action('Sideline', new ActionOptions()).registerNeverAutoResolve()
            ])
        );
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
            if (phase.gameOver) return true;

            // first, if we've chosen everything possible, then we clear the action
            phase.actions = phase.actions.filter(action => {
                // these actions must be manually cleared
                if (!action.clearOnEmpty || action.neverAutoResolve) return true;

                // if we haven't yet chosen all of the things we needed to choose, then we continue choosing
                if (action.numberResolved < action.chooseNumber && action.countToResolve() >= action.chooseNumber) return true;

                return false;
            });

            // if all actions have been resolved, or if we are marked with "end this phase", exit this phase
            if (phase.actions.length == 0) return false;
            else return !phase.endThisPhase;
        });

        let endLen = this.stack.length;

        return beginLen != endLen;
    }

    endCurrentPhase(): void {
        this.stack.pop();
    }
}

export class ActionOptions {
    mustChooseAll: boolean = false;
    chooseNumber: number = 1;
    canChooseTargetsMoreThanOnce: boolean = false;
}
export class Action {
    name: ActionName;
    chooseNumber: number; // how many choices we need to make
    mustChooseAll: boolean; // rather than a specific number, the user has to keep resolving til there's nothing left
    canChooseTargetsMoreThanOnce: boolean; // user may choose the same thing multiple times

    neverAutoResolve = false;
    clearOnEmpty = true;

    private idsToResolve: string[] = [];
    private resolvedIds: string[] = [];

    // This is used to track any information an action needs to carry forward in this phase,
    // e.g., which attacker we're currently resolving.
    extraState: PrimitiveMap = {};

    constructor(name: ActionName, options: ActionOptions) {
        this.name = name;
        this.chooseNumber = options.chooseNumber;
        this.mustChooseAll = options.mustChooseAll;
        this.canChooseTargetsMoreThanOnce = options.canChooseTargetsMoreThanOnce;
    }

    serialize(): ObjectMap {
        return {
            name: this.name,
            idsToResolve: this.idsToResolve,
            resolvedIds: this.resolvedIds,
            mustChooseAll: this.mustChooseAll,
            chooseNumber: this.chooseNumber,
            canChooseTargetsMoreThanOnce: this.canChooseTargetsMoreThanOnce,
            neverAutoResolve: this.neverAutoResolve,
            extraState: this.extraState
        };
    }

    static deserialize(pojo: ObjectMap): Action {
        let action = new Action(<ActionName>pojo.name, {
            mustChooseAll: <boolean>pojo.mustChooseAll,
            chooseNumber: <number>pojo.chooseNumber,
            canChooseTargetsMoreThanOnce: <boolean>pojo.canChooseTargetsMoreThanOnce
        });
        action.idsToResolve = <string[]>pojo.idsToResolve;
        action.resolvedIds = <string[]>pojo.resolvedIds;
        action.neverAutoResolve = <boolean>pojo.neverAutoResolve;
        action.extraState = <PrimitiveMap>pojo.extraState;
        return action;
    }

    registerNeverAutoResolve(): Action {
        this.neverAutoResolve = true;
        return this;
    }

    registerEmptyActionForAutoResolve(): Action {
        this.clearOnEmpty = false;
        this.chooseNumber = 0;
        return this;
    }

    addIds(ids: string[]) {
        this.idsToResolve.push(...ids);

        if (this.mustChooseAll) {
            this.chooseNumber += ids.length;
        }
    }

    addCards(cards: Card[]): void {
        cards.map(card => this.addIds([card.cardId]));
    }

    /** @ids could be card IDs OR BuildingTypes */
    resolveIds(ids: string[]): void {
        ids.map(id => this.resolveId(id));
    }

    resolveId(id: string) {
        this.resolvedIds.push(id);

        if (!this.canChooseTargetsMoreThanOnce) {
            let index = this.idsToResolve.findIndex(thisId => thisId === id);

            if (index > -1) {
                this.idsToResolve.splice(index, 1);
            }
        }
    }

    /** @returns whether or not card can be found in list of must resolved */
    ifToResolve(cardId: string): boolean {
        return this.idsToResolve.filter(thisId => thisId === cardId).length > 0;
    }

    countToResolve(): number {
        return this.idsToResolve.length;
    }

    get numberResolved() {
        return this.resolvedIds.length;
    }

    get onlyPossibleId() {
        if (this.idsToResolve.length > 1) throw new Error('More than one ID is possible to resolve');
        else return this.idsToResolve[0];
    }

    get canAutoResolve() {
        return !this.neverAutoResolve && this.idsToResolve.length < 2;
    }
}

export class Phase {
    actions: Action[] = [];

    endThisPhase: boolean = false;

    gameOver: boolean = false;

    // In some cases, we may do different things based on which ID is selected.
    // If necessary, we record the thing to do for each ID here.
    actionsForIds: StringMap = {};

    constructor(actions: Action[]) {
        this.actions = actions;
    }

    serialize(): ObjectMap {
        return {
            actions: this.actions.map(action => action.serialize()),
            actionsForIds: this.actionsForIds
        };
    }

    static deserialize(pojo: ObjectMap): Phase {
        let actions = (<ObjectMap[]>pojo.actions).map(action => Action.deserialize(action));
        let phase = new Phase(actions);
        phase.actionsForIds = <StringMap>pojo.actionsForIds;
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

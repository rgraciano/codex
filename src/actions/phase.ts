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
    | 'DiesOrLeaves'
    | 'PlayerPrompt'
    | 'GameOver'
    | 'Destroy'
    | 'Attack'
    | 'PrepareAttackTargets'
    | 'AttackDestination'
    | 'ChooseAbilityTarget'
    | 'ChooseTowerReveal'
    | 'Staging';

// The client uses Actions to understand what API calls are currently valid, and how to present possible actions to the user.
export type ActionName =
    | 'NewGame'
    | 'StagingAbility'
    | 'UpkeepChoice'
    | 'ArrivesChoice'
    | 'DiesOrLeavesChoice'
    | 'DestroyChoice'
    | 'AttacksChoice'
    | 'PrepareAttackTargets'
    | 'AttackCardsChoice'
    | 'AttackCardsOrBuildingsChoice'
    | 'AbilityChoice'
    | 'TowerRevealChoice'
    | TurnActionName;

export type TurnActionName =
    | 'PlayCard'
    | 'Worker'
    | 'Tech'
    | 'Build'
    | 'Patrol'
    | 'Ability'
    | 'Attack'
    | 'HeroSummon'
    | 'HeroLevel'
    | 'EndTurn'
    | 'TowerReveal';

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

    validActions(): ActionName[] {
        return this.topOfStack().validActions;
    }

    /** This will clear out any phases that are no longer valid because they have cleared out all required cards.
     * Cards may have died due to effects or simply been resolved.
     * @returns true if phases were eliminated, false if not */
    resolveEmptyPhases(): boolean {
        let beginLen = this.stack.length;

        this.stack = this.stack.filter(phase => {
            if (phase.resolvesOnEmpty) return phase.idsToResolve && phase.idsToResolve.length > 0;
            else return !phase.endThisPhase;
        });

        let endLen = this.stack.length;

        return beginLen != endLen;
    }

    endCurrentPhase(): void {
        this.stack.pop();
    }
}

export class Phase {
    name: PhaseName;

    validActions: ActionName[] = [];

    resolvesOnEmpty: boolean = true;
    endThisPhase: boolean = false;

    /*
     * We both keep a list of cards we have to resolve still,
     * as well as a list of resolved, because we will recalculate the list as we go.
     *
     * In some actions, it will be mandatory to resolve all of them to move forward.
     * In other actions, it will be a choice between things to resolve.
     *
     * The client doesn't need to know or care either way. It highlights everything
     * in the list, and when the user clicks something in the list, the back-end
     * updates the list by either clearing it or removing the option they just resolved.
     * The client then simply (dumbly) again highlights the whatever is on the list.
     *
     * Each map has:
     * 'resolveId'
     */
    idsToResolve: string[];
    resolvedIds: string[];

    // In some cases, we may do different things based on which ID is selected.
    // If necessary, we record the thing to do for each ID here.
    actionsForIds: StringMap = {};

    // This is used to track any information an action needs to carry forward in this phase,
    // e.g., which attacker we're currently resolving.
    extraState: PrimitiveMap = {};

    constructor(name: PhaseName, validActions: ActionName[], resolvesOnEmpty: boolean = true) {
        this.name = name;
        this.validActions = validActions;

        this.idsToResolve = [];
        this.resolvedIds = [];

        this.resolvesOnEmpty = resolvesOnEmpty;
    }

    serialize(): ObjectMap {
        return {
            name: this.name,
            validActions: this.validActions,
            idsToResolve: this.idsToResolve,
            resolvedIds: this.resolvedIds,
            actionsForIds: this.actionsForIds,
            extraState: this.extraState,
            resolvesOnEmpty: this.resolvesOnEmpty
        };
    }

    static deserialize(pojo: ObjectMap): Phase {
        let phase = new Phase(<PhaseName>pojo.name, <ActionName[]>pojo.validActions);
        phase.idsToResolve = <string[]>pojo.idsToResolve;
        phase.resolvedIds = <string[]>pojo.resolvedIds;
        phase.actionsForIds = <StringMap>pojo.actionsForIds;
        phase.extraState = <PrimitiveMap>pojo.extraState;
        phase.resolvesOnEmpty = <boolean>pojo.resolvesOnEmpty;
        return phase;
    }

    markCardsToResolve(cards: Card[], action?: string): void {
        this.markIdsToResolve(cards.map(card => card.cardId), action);
    }

    /** @ids could be card IDs OR BuildingTypes */
    markIdsToResolve(ids: string[], action?: string): void {
        this.idsToResolve.push(...ids);

        if (action) ids.map(id => (this.actionsForIds[id] = action));
    }

    /** @returns whether or not card can be found in list of must resolved */
    ifToResolve(cardId: string): boolean {
        return this.idsToResolve.filter(thisId => thisId === cardId).length > 0;
    }

    isValidAction(action: ActionName): boolean {
        return this.validActions.indexOf(action) !== -1;
    }

    markResolved(cardId: string) {
        this.resolvedIds.push(cardId);

        let index = this.idsToResolve.findIndex(thisId => thisId === cardId);
        if (index > -1) {
            this.idsToResolve.splice(index, 1);
        }
    }

    wasDone(cardId: string): boolean {
        return this.resolvedIds.indexOf(cardId) !== -1;
    }
}

export type PrimitiveMap = {
    [k: string]: string | number | boolean;
};

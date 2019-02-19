
import { Card } from '../cards/card';

export type PhaseName = 'PlayerTurn' | 'NewGame' | 'Upkeep';
export type ActionName = 'NewGame' | 'UpkeepChoice' | TurnActionName;
export type TurnActionName = 'PlayCard' | 'Worker' | 'Tech' | 'BuildTech' | 'BuildAddOn' | 'Patrol' | 'Ability' | 'Attack' | 'HeroSummon' | 'HeroLevel' | 'EndTurn';

// note patrol and un-patrol will need to be options, or attack/ability/exhaust will need to check if patrolling and
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
    stack: Array<Phase>;

    /** This only gets called at the beginning of the game, to create a new set of nested actions to track */
    constructor() {
        this.stack = [ new Phase('NewGame', [ ] ) ];
    }

    addToStack(newTop: Phase): void {
        this.stack.push(newTop);
    }

    topOfStack(): Phase {
        return this.stack[this.stack.length - 1];
    }

    isValidAction(action: ActionName): boolean {
        return this.topOfStack().isValidAction(action);
    }

    validActions(): Array<ActionName> {
        return this.topOfStack().validActions;
    }

    /** This will clear out any phases that are no longer valid because they have cleared out all required cards.  Cards may have died due to effects or simply been resolved */
    resolveEmptyPhases(): void {
        this.stack = this.stack.filter(phase => {
            switch (phase.name) {
                case 'Upkeep':
                    if (phase.mustResolveIds.length === 0) {
                        return false;
                    }
                default:
                    return true;
            }
        });
    }

    endCurrentPhase(): void {
        this.stack.pop();
    }
}

export class Phase {
    name: PhaseName;

    validActions: Array<ActionName> = [];

    // We both keep a list of cards we have to resolve still, 
    // as well as a list of resolved, because we will recalculate the list as we go.
    // E.g., say it's Upkeep time.  The game generates a list of cards to resolve upkeep
    // triggers on (here).  You pick one to resolve first, and the game does its thing and lists 
    // it on resolvedIds.  It then redoes the mustResolveIds list, just in case you actually
    // killed a thing on the list or otherwise removed it from consideration.  If you didn't kill it, 
    // then it needs the resolvedIds list to make sure it doesn't allow you to re-execute it.
    mustResolveIds: Array<string> = [];
    resolvedIds: Array<string> = [];

    constructor(name: PhaseName, validActions: Array<ActionName>) {
        this.name = name;
        this.validActions = validActions;
    }

    /** Filters out already resolved cards and cards already on the list, and adds all of the rest to the mustResolve list */
    filterResolvedAndMarkMustDo(cards: Array<Card>): void {
        let cardIds: Array<string> = cards.map(card => { return card.cardId });
        this.mustResolveIds.push(...cardIds.filter(cardId => { return (this.resolvedIds.indexOf(cardId) >= 0) && (this.mustResolveIds.indexOf(cardId) >= 0) }));
    }

    mustResolve(cardId: string): boolean {
        return this.mustResolveIds.indexOf(cardId) !== -1;
    }

    isValidAction(action: ActionName) {
        return this.validActions.indexOf(action) !== -1;
    }

    markResolved(cardId: string) {
        this.resolvedIds.push(cardId);

        let index = this.mustResolveIds.indexOf(cardId);
        if (index > -1) {
            this.mustResolveIds.splice(index, 1);
        }
    }

    wasDone(cardId: string): boolean {
        return this.resolvedIds.indexOf(cardId) !== -1;
    }

    finished(): boolean {
        return this.resolvedIds.length === 0;
    }
}

import { Card } from '../cards/card';

type PhaseName = 'Player1TurnStart' | 'Player2TurnStart' | 'NewGame';
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

    topOfStack(): Phase {
        return this.stack[this.stack.length - 1];
    }

    isValidAction(action: string): boolean {
        return this.topOfStack().isValidAction(action);
    }

    validActions(): Array<string> {
        return this.topOfStack().validActions;
    }
}

export class Phase {
    phase: PhaseName;

    validActions: Array<string> = [];

    // We both keep a list of cards we have to resolve still, 
    // as well as a list of resolved, because we will recalculate the list as we go.
    // E.g., say it's Upkeep time.  The game generates a list of cards to resolve upkeep
    // triggers on (here).  You pick one to resolve first, and the game does its thing and lists 
    // it on resolvedTriggers.  It then redoes the mustResolveTriggersOn list, just in case you actually
    // killed a thing on the list or otherwise removed it from consideration.  If you didn't kill it, 
    // then it needs the resolvedTriggers list to make sure it doesn't allow you to re-execute it.
    mustResolveTriggersOn: Array<Card> = [];
    resolvedTriggers: Array<Card> = [];

    constructor(phase: PhaseName, validActions: Array<string>) {
        this.phase = phase;
        this.validActions = validActions;
    }

    isValidAction(action: string) {
        return this.validActions.indexOf(action) !== -1;
    }

    markResolved(card: Card) {
        this.resolvedTriggers.push(card);
    }

    wasDone(card: Card): boolean {
        return this.resolvedTriggers.indexOf(card) !== -1;
    }

    finished(): boolean {
        return this.resolvedTriggers.length === 0;
    }
}
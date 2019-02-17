
import { Card } from '../cards/card';
import {anyid} from 'anyid';

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
    phaseStack: Array<Phase>;

    /** This only gets called at the beginning of the game, to create a new set of nested actions to track */
    constructor() {
        this.phaseStack = [ new Phase('NewGame', [ ] ) ];
    }

    isValidAction(action: string): boolean {
        let topOfStack = this.phaseStack[this.phaseStack.length - 1];
        return topOfStack.isValidAction(action);
    }
}

export class Phase {
    phase: PhaseName;
    validActions: Array<string> = [];
    randId: string;
    doneTriggers: Array<Card> = [];

    constructor(phase: PhaseName, validActions: Array<string>) {
        this.phase = phase;
        this.validActions = validActions;
        this.randId = anyid().encode('Aa0').length(10).random().id();
        // TODO: it's technically possible to experience a collision but the odds against are completely nuts...
    }

    isValidAction(action: string) {
        return this.validActions.indexOf(action) !== -1;
    }

    markDone(card: Card) {
        this.doneTriggers.push(card);
    }

    wasDone(card: Card): boolean {
        return this.doneTriggers.indexOf(card) !== -1;
    }

    finished(): boolean {
        return this.doneTriggers.length === 0;
    }
}
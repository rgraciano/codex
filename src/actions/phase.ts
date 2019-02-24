
import { Card } from '../cards/card';
import { Game } from '../game';
import { ObjectMap } from '../game_server';

export type PhaseName = 'PlayerTurn' | 'NewGame' | 'Upkeep' | 'Arrives';
export type ActionName = 'NewGame' | 'UpkeepChoice' | 'ArriveChoice' | TurnActionName;
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
    stack: Array<Phase> = new Array<Phase>();

    setupForNewGame() {
        this.stack = [ new Phase('NewGame', [ ] ) ];
    }

    serialize(): ObjectMap {
        return { stack: this.stack.map(phase => phase.serialize()) };
    }

    static deserialize(pojo: ObjectMap): PhaseStack {
        let ps = new PhaseStack();
        ps.stack = (<Array<ObjectMap>>pojo.stack).map(phase => Phase.deserialize(phase));
        return ps;
    }

    addToStack(newTop: Phase): void {
        this.stack.push(newTop);
    }

    topOfStack(): Phase {
        return this.stack[this.stack.length - 1];
    }

    validActions(): Array<ActionName> {
        return this.topOfStack().validActions;
    }

    /** This will clear out any phases that are no longer valid because they have cleared out all required cards.  Cards may have died due to effects or simply been resolved */
    resolveEmptyPhases(): void {
        this.stack = this.stack.filter(phase => {
            switch (phase.name) {
                case 'Upkeep':
                case 'Arrives':
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

    serialize(): ObjectMap {
        return { 
            name: this.name, 
            validActions: this.validActions 
        };
    }

    static deserialize(pojo: ObjectMap): Phase {
        return new Phase(<PhaseName>pojo.name, <Array<ActionName>>pojo.validActions);
    }

    /** 
     * Adds cards that must be resolved.
     */
    markMustResolve(cards: Array<Card>): void {
        this.mustResolveIds.push(...cards.map(card => { return card.cardId }));
        //this.mustResolveIds.push(...cardIds.filter(cardId => { return (this.resolvedIds.indexOf(cardId) >= 0) && (this.mustResolveIds.indexOf(cardId) >= 0) })); // to also filter... no longer needed
    }

    ifMustResolve(cardId: string): boolean {
        return this.mustResolveIds.indexOf(cardId) !== -1;
    }

    isValidAction(action: ActionName): boolean {
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

export function findCardsToResolve(game: Game, space: Array<Card>, handlerFnName: string) {
    // find all of the cards with handlers that match
    let foundCards: Array<Card> = Game.findCardsWithHandlers(space, handlerFnName);

    // add all of those cards to the list of allowedActions, automatically removing those that were already resolved and ensuring there are no duplicates
    game.phaseStack.topOfStack().markMustResolve(foundCards);
}

import { Card } from '../cards/card';
import { ObjectMap, StringMap } from '../game_server';

export type PhaseName = 'PlayerTurn' | 'NewGame' | 'Upkeep' | 'Arrives' | 'DiesOrLeaves' | 'PlayerPrompt';
export type ActionName = 'NewGame' | 'UpkeepChoice' | 'ArrivesChoice' | 'DiesOrLeavesChoice' | TurnActionName;
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

    /** This will clear out any phases that are no longer valid because they have cleared out all required cards.  
     * Cards may have died due to effects or simply been resolved.
     * @returns true if phases were eliminated, false if not */
    resolveEmptyPhases(): boolean {
        let beginLen = this.stack.length;

        this.stack = this.stack.filter(phase => {
            switch (phase.name) {
                case 'Upkeep':
                case 'Arrives':
                    if (phase.mustResolveMaps.length === 0) {
                        return false;
                    }
                default:
                    return true;
            }
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

    validActions: Array<ActionName> = [];

    /* 
    * We both keep a list of cards we have to resolve still, 
    * as well as a list of resolved, because we will recalculate the list as we go.
    * 
    * Each map has:
    * 'resolveId' 
    */
    mustResolveMaps: ResolveMap[] = [];
    resolvedIds: Array<string> = [];

    constructor(name: PhaseName, validActions: Array<ActionName>) {
        this.name = name;
        this.validActions = validActions;
    }

    serialize(): ObjectMap {
        return { 
            name: this.name, 
            validActions: this.validActions,
            mustResolveMaps: this.mustResolveMaps,
            resolvedIds: this.resolvedIds
        };
    }

    static deserialize(pojo: ObjectMap): Phase {
        let phase = new Phase(<PhaseName>pojo.name, <Array<ActionName>>pojo.validActions);
        phase.mustResolveMaps = <ResolveMap[]>pojo.mustResolveMaps;
        phase.resolvedIds = <Array<string>>pojo.resovedIds;
        return phase;
    }

    /** 
     * Adds cards that must be resolved.
     */
    markMustResolve(cards: Array<Card>, handlerFnName: string, markExtraParams?: (map: ResolveMap) => ResolveMap): void {
        this.mustResolveMaps.push(...cards.map(card => {
            let map = { 
                resolveId: card.cardId,
                action: handlerFnName
            };
            return markExtraParams ? markExtraParams(map) : map;
        }));
    }

    /** @returns whether or not card can be found in list of must resolved */
    ifMustResolve(cardId: string): boolean {
        return (this.mustResolveMaps.filter(map => map['resolveId'] === cardId)).length > 0;
    }

    /** @returns Tuple of [cardId, handlerFnName] if found in mustResolve list, or undefined if not */
    getMustResolveMapForCardId(cardId: string): ResolveMap {
        return this.mustResolveMaps.find(map => map['resolveId'] === cardId);
    }

    isValidAction(action: ActionName): boolean {
        return this.validActions.indexOf(action) !== -1;
    }

    markResolved(cardId: string) {
        this.resolvedIds.push(cardId);

        let index = this.mustResolveMaps.findIndex(map => map['resolveId'] === cardId);
        if (index > -1) {
            this.mustResolveMaps.splice(index, 1);
        }
    }

    wasDone(cardId: string): boolean {
        return this.resolvedIds.indexOf(cardId) !== -1;
    }

    finished(): boolean {
        return this.resolvedIds.length === 0;
    }
}
export class ResolveMap extends StringMap {
    resolveId: string;
    action: string;
}
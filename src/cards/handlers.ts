import { Card } from './card';
import { EventDescriptor } from '../game';
import { PatrolZone } from 'board';

/*
 *
 *
 * ALTERATIONS: These are properties on a card that alter game play in some simple way when set.  These are never
 *              re-ordered and they are primitives with little behavior.
 *
 */

export interface WorkersAreFreeAlteration extends Card {
    workersAreFree: boolean;
}

/** Alters the cost of a card. Returns the alteration, not the final cost.  E.g., returns -1 to reduce cost by 1 */
export interface CardCostAlteration extends Card {
    alterCost(card: Card): number;
}

/*
*
*
* HOOKS: Like alterations, when active, these cards alter game play in a straightforward way.
         Hooks are a bit more complex than alterations in that they may need to look at a card to decide whether 
         or not they can alter it, and they may alter it in more intricate ways.
         
         Hooks do not cause choices, enter phases, etc - they alter things immediately and can not be re-ordered.
*
*/

/** For cards like Abomination or Nimble Fencer, they modify card status all the time, according to some selection criteria (eg Fencer modifies Virtuosos) */
export interface GlobalBonusHook extends Card {
    giveBonus(card: Card): EventDescriptor; // call this to give the bonus to a card; usually called when this arrives or something else arrives
    removeBonus(card: Card): EventDescriptor; // when card dies, use this to remove the bonus we applied earlier
}

/** When a card is about to die, this can trigger to do something (e.g. save it) */
export interface WouldDieHook extends Card {
    wouldDie(cardToDie: Card): EventDescriptor;
}

/** Called when ANY card would be discarded, including this card */
export interface WouldDiscardHook extends Card {
    wouldDiscard(cardToDiscard: Card): EventDescriptor;
}

/** Called when a Hero hits mid-level if applicable. Not all heroes will implement */
export interface HeroMidHook extends Card {
    heroMid(): EventDescriptor;
    heroLoseMid(): EventDescriptor;
}

/** Called when a Hero hits max-level if applicable. Not all heroes will implement */
export interface HeroMaxHook extends Card {
    heroMax(): EventDescriptor;
    heroLoseMax(): EventDescriptor;
}

export interface PatrolHook extends Card {
    patrol(slot: keyof PatrolZone): EventDescriptor;
    sideline(slot: keyof PatrolZone): EventDescriptor;
}

/*
*
*
* HANDLERS: Handlers are used when a bunch of things may happen at the same time, and the user needs to choose which thing
            happens first.  The game will first enter a phase for the handler, then look for all handlers that apply to that
            phase, and then prompt the user to choose which one to call first.  The front end is aware of each handler type
            so that it can present the options to the user.

            Most effects are handlers because most things in Codex can be re-ordered by the user.
*/

export interface AttacksHandler extends Card {
    onAttack(attacker: Card, defender: Card): EventDescriptor;
}

export interface UpkeepHandler extends Card {
    onUpkeep(): EventDescriptor;
}

/** Called when ANY card arrives, including this card */
export interface ArrivesHandler extends Card {
    onArrives(arrivingCard: Card): EventDescriptor;
}

/** Called when ANY card dies, including this card */
export interface DiesHandler extends Card {
    onDies(dyingCard: Card): EventDescriptor;
}

/** Called when ANY card leaves play, including this card */
export interface LeavesHandler extends Card {
    onLeaves(leavingCard: Card): EventDescriptor;
}

/** Called when ANY card attacks, including this card */
export interface AttacksHandler extends Card {
    onAttacks(attackingCard: Card): EventDescriptor;
}

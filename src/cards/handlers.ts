import { Card } from './card';
import { EventDescriptor } from '../game';
import { BoardBuilding, PatrolZone, Board } from '../board';

/*
 *
 *
 * ALTERATIONS: Use an alteration when card text breaks the rules of the game.  Alterations always return something, telling
 *              the engine what to do when the rules are broken (e.g., ignore patrollers- which patrollers?  Alter cost - by how much?)
 *
 *              The rules engine looks for alterations at specific times and adjusts rules accordingly when it finds them.
 *
 *              We are always looking to get something back from an alteration - a number, or what specific thing was altered -
 *              so the rules engine can act on the thing that was altered.
 */

export interface WorkersAreFreeAlteration extends Card {
    workersAreFree: boolean;
}

/** Alters the cost of a card. Returns the alteration, not the final cost.  E.g., returns -1 to reduce cost by 1 */
export interface CardCostAlteration extends Card {
    alterCost(card: Card): number;
}

/** Returns true if this unit can attack this building (regardless of patrollers).  Some cards make buildings flying or unattackable,
 *  and this accounts for those situations */
export interface BuildingAttackableAlteration extends Card {
    alterCanAttackBuildings(cardAttacking: Card, buildingDefender: BoardBuilding): boolean;
}

/** Returns the alteration (amount of damage to add or subtract) given a defender. E.g., returns 3 to add 3 damage to an attack */
export interface DealCombatDamageAlteration extends Card {
    alterCombatDamage(cardAttacking: Card, cardDefending?: Card, buildingDefender?: BoardBuilding): number;
}

/** Returns the alteration (amount of damage to add or subtract) given a target. E.g., returns 3 to add 3 direct damage */
export interface DealDirectDamageAlteration extends Card {
    alterDamage(cardDamaging: Card, cardTarget?: Card, buildingTarget?: BoardBuilding): number;
}

/** If this character is unstoppable when attacking, returns the types of things it's unstoppable by.  This is to manage
 * Masked Raccoon, Colossus, Wight, Predator Tiger. */
export type UnstoppableWhenAttacking = 'Base' | 'Building' | 'Heroes' | 'Units' | 'Everything' | 'SkipsTech0Patrollers' | 'None';
export interface UnstoppableWhenAlteration extends Card {
    alterUnstoppable(cardAttacking: Card): UnstoppableWhenAttacking;
}

/**
 * If this character can only be attacked by certain things under certain conditions, eg Masked Raccoon.
 * @returns true if unattackable by cardAttacking
 */
export interface UnattackableByAlteration extends Card {
    alterUnattackable(cardAttacking: Card): boolean;
}

/** @returns true if stealth when attacking units.  Specific to Stalking Tiger */
export interface StealthWhenAttackingUnitsAlteration extends Card {
    alterStealthWhenAttackingUnits(cardAttacking: Card): boolean;
}

/*
*
*
* HOOKS: Use hooks when something happens at a specific time in the game, but no user choice will ever be required.  Hooks
        are not able to handle user choice.

        Hooks don't return anything - they do something, and then return an EventDescriptor.  They are events that happen
         at specific times, but they can not prompt user actions, enter into new game phases, etc.  They do something 
         immediately and can not be re-ordered.

        The reason we need both Hooks and Handlers is because of how the game engine manages them.  In a Handler, the rules
        engine will stop whatever it is doing to run the Handler.  Calling the Handler will always be the last thing it does
        in a sub-routine, because the Handler interrupts game logic.  With a Hook OTOH, the rules engine will *not* stop what 
        it's doing - if it's in the middle of a sub-routine like "dies", it calls the Hook and then continues running the 
        sub-routine.  Naming them and separating them is important because you can then choose the correct one when
        implementing a card.

        Good Hook examples are "would die" and "would discard", which can change if something would die or where it would be
        discarded to (graveyard does this).   We can implement these things without prompting the user for any kind of choice,
        so we do them as hooks where we can.  By way of contrast, "Arrives" may prompt the user to pick a card, which interrupts
        the flow of the game, so we implement that as a Handler instead of a Hook.
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

/** Called if a character gets special bonuses for patrolling */
export interface PatrolHook extends Card {
    patrol(slot: keyof PatrolZone): EventDescriptor;
    sideline(slot: keyof PatrolZone): EventDescriptor;
}

export interface DealCombatDamageHook extends Card {
    dealCombatDamage(cardDealingDamage: Card, cardReceivingDamage: Card): EventDescriptor;
}

/*
*
*
* HANDLERS: Handlers are used when a user choice may occur.  Any time the user needs to choose which thing happens first,
            or choose a target, a handler is used.

            The game will first enter a phase for the handler, then look for all handlers that apply to that
            phase, and then prompt the user to choose which one to call first.  The front end is aware of each handler type
            so that it can present the options to the user.
*/

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

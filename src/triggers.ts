
// Safe Attacking is a good one to model.  How do we give attacking units 1 armor when they attack, but remember to
// remove the armor if they survive?
// I'm thinking...
//    There's an "attack" action
//    Attack action looks for onAttack triggers
//    onAttack probably takes the same parameters as Attack (character, & what they're attacking).  Boards will always be accessible to everything, b/c triggers will often impact the board
//    onAttack adds a "temporaryArmor" property to the attacking character
//    Attack action knows how to use temporaryArmor and clears it when the attack is over, if the attacker survives
//        ... and what if you're doing it to Doubling Barbarbarian?  He would get twice the bonus
//        ... maybe we just implement a special Attributes for him and there are special set methods for properties?
//        ... this would mean we'd always have to use set() for properties, everywhere
//
// We'll be able to re-order triggers within a particular action, which kind of makes sense.  We could just shove them in an array and allow the user to re-order them, then call them in order upon confirmation.
//
// "Dies" will have to be an event or trigger itself, as will Draw

import { Card } from './cards/cards';

/**
 * When something happens, we:
 *      1) Look for handlers on all potentially affected cards
 *      2) Call each handler
 *          2a) Each handler builds a function representing what would happen when that trigger is executed, and a description of what would happen
 *          2b) Each handler adds that function to the end of the activeList
 *          2c) Note that in the middle of this process, this whole thing may need to nest (look for more handlers, process those handlers, etc) and
 *              the result is a flattened set of triggers in the activeList because they'll all just keep appending to the list
 *      3) At first, the game will just present the list to the user and ask them to confirm, rewind, or re-order. Later on we can have the game
 *         try to guess at the optimal ordering based on user outcome (e.g. sum of all health/atk on active player units vs opposing player units, game end events, etc)
 * 
 *         What we'll have to figure out is how to interrupt the stack for a Draw event (or similar), which needs to be confirmed but can't be unwound.
 *         At the moment we need to target or draw or whatever, we will immediately go out and prompt the user to make a decision.
 */
export class Trigger {
    public description: string;
    public execute: () => (Trigger | null) = function() { return null; };

    constructor(description: string, execute?: () => (Trigger | null)) {
        if (execute)
            this.execute = execute;
        
        this.description = description;
    }
}

interface AttackHandler {
    onAttack(attacker: Card, defender: Card): Trigger;
}

interface GoldHandler {
    onCollectGold(goldAmount: number): Trigger;
}

//function processTriggers(targets: )
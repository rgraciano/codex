

import { Game } from '../game';
import { Card } from '../cards/card';

export function attackAction(attacker: Card) {
    // choose attacker
    // mark stats accordingly (has attacked, etc). use readiness to potentially exhaust

    // enter phase that is empty, to choose the target of the attack. give it one resolveId (attacker) so that it will auto-execute 
        // when the attack handlers are all done

    // enter phase for attack handlers
    // fire attacks, obliterate handlers. cards may modify attacks, e.g. safe attacking, giving temporary 'while attacking' stats
        // .. how to handle armor? we need to track armor in the duration of a turn
}

export function chooseTarget() {
    // check if attacker still alive; if not, we can simply exit this phase indicating that attacker is dead and therefore attack has stopped

    // if alive, prepare a list of possible defenders and return them to the user for selection. note buildings can be attacked as well.
        // this is where we account for stealth, flying, unstoppable, invisible. need to account for tower 
        // detecting the FIRST stealth attacker; track that on tower probably? perhaps use turn number?
}

export function attackChosenTarget() {
    // check what was chosen. is it attackable? if not, throw an error. note buildings can be attacked as well

    // enter phase that is empty, to resolve the attack. give it one resolveId (attacker) so it will execute

    // a defender was chosen; fire any defense handlers
        // I think Debilitator Alpha is the only card in the game that is impacted here.  There's no "Safe Defending" card
        // No harm in implementing this as a standard handling thing anyway...
}

export function resolveAttack() {
    // check if attacker still alive; if not, we can simply exit this phase indicating that attacker is dead and therefore attack has stopped

    // attacker and defender now deal damage simultaneously to each other
        // account for swift strike. account for anti-air also hitting fliers
    
    // if there's overpower and there's excess damage to be done, we'll add the overpower phase now, because we want it to be in
        // the stack BEFORE things die (so it will be executed AFTER they die)
        // do sparkshot first; enter phase, pick targets, etc. create a subroutine for this.
        // do overpower next; choose another attack target, and then do direct damage to that target. create a subroutine for this. might trigger dies()
      
    // call on damage handlers. arguments would be thing doing the damage, thing being damaged.  
        // e.g. Guardian of the Gates will disable an attacker, if it survives

    // if the defender and attacker die, go into dies() for each. we do this LAST, so the user will be asked to resolve it FIRST
}  


    // check BloomingElm.ts for description of temporary stats and how they should work before implementing this
    
    // first process onAttack triggers; these can be re-ordered
    // re-ordering stops here

    // game state check & trigger loop

    // next process damage, process any onDamage triggers (do these exist?)
    // no re-ordering possible (i think...)

    // check game state & trigger loop

    // process sparkshot, overpower if something died; process onDamage triggers on those targets if this is a thing
    
    // check game state & trigger loop

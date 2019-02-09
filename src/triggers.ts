
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

class Trigger {

}

interface GoldTrigger {
    onCollectGold(goldAmount: number): Trigger;
}
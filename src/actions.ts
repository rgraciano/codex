


// Actions are events in the game that can spawn triggers, like upkeep, attack, patrol, etc.
// This could work like -
//     1) Client chooses to perform an action.  Client asks the server for valid targets for
//     that action and so on.  Server returns all of that stuff.
//     2) Client then chooses to do a thing and the server enters an Action routine for the current
//     board state.  It will then start creating triggers, stopping when it needs the user to make a choice
//     or when something can't be unwound.
//     3) Server returns the list of triggers to the client and prompts the client to choose targets for any triggers requiring them.  
//     Server validates / saves those choices and continues building the trigger list, repeating this process as necessary. 
//     4) Client submits its choices; server runs same routine, but this time runs everything at the end according to the user's choices.
//     5) Repeat until action is done, print out board state.
//
// Note we only prompt the user if: 1) for triggers, there's more than one choice (could be zero or one); 2) the game has figured out that re-ordering
// triggers produces a different outcome (Board state)

// Starting to model a server state...
class ActionState {
    public activeTriggers: Array<Trigger> = new Array();
}

function attack(attackingBoard: Board, defendingBoard: Board, attacker: Card, defender: Card) {
    // first process onAttack triggers; these can be re-ordered
    // re-ordering stops here
   
    // game state check & trigger loop

    // next process damage, process any onDamage triggers (do these exist?)
    // no re-ordering possible (i think...)

    // check game state & trigger loop

    // process sparkshot, overpower if something died; process onDamage triggers on those targets if this is a thing
    
    // check game state & trigger loop
}
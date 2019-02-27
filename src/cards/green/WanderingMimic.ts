
// This card is potentially a nightmare to deal with.

// Here's how we'll do it -

// We add an Arrives() hook for it.  When it Arrives(), if it sees itself as the arriving card, it will search all other cards and 
// modify its own stats according to what it sees.
//
// We'll also add a LeavesPlay() hook.  When ANOTHER card Arrives() or LeavesPlay(), WanderingMimic will adjust its own stats accordingly.
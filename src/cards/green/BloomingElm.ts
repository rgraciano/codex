
// "Your units with +1/+1 runes have overpower"

// Since overpower really only takes effect while attacking... we could run an OnAttacks hook.
// BloomingElm implements OnAttacks.  If the attacking card has a +1/+1 rune on it, BloomingElm gives it temporaryOverpower.
//
// At the end of the attack phase, we always set temporaryOverpower to zero.
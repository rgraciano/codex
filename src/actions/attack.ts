

import { Game } from '../game';
import { Card } from '../cards/card';

export function attack(game: Game, attacker: Card, defender: Card) {
    // first process onAttack triggers; these can be re-ordered
    // re-ordering stops here

    // game state check & trigger loop

    // next process damage, process any onDamage triggers (do these exist?)
    // no re-ordering possible (i think...)

    // check game state & trigger loop

    // process sparkshot, overpower if something died; process onDamage triggers on those targets if this is a thing
    
    // check game state & trigger loop
}
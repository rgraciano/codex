
/*
BOARDS: SERIALIZATION
1) for each board
2) store playerNumber, turnCount, gold, baseHealth, startingWorkers
3) for each zone, store the zone name to re-populate, and serialize all cards
  CALL CARD SERIALIZE()
  -  key is card ID
  - track class name to re-hydrate
  - track contains: Array<Card> (use something that generically does that)
  - track owner, controller
  - call constructor with card ID
	- call deserializeCard with owner, controller, contains (?)
	- call deserializeAttributes to re-hydrate attributeModifiers. skip if property is zero for readability...?
  - other types of card, e.g. hero, will need their own deserialize to reset justDied etc
  - should return a card serialized object to be written to disk
  SPACE RETURNS... ARRAY OF CARD SERIALIZED OBJECTS
  


BOARDS: DESERIALIZATION
1) for each board read
2) instantiate board
3) set playerNumber, turnCount, gold, baseHealth
4) for each zone, iterate over cards, deserializing from Card method and adding to the correct zone
   - dont forget patrolZone...
5) for each tech building & addOn make a new tech building with the right stats


... do some similar stuff in game. we really only need to store the phaseStack here and that's it.  we have to move the stuff in the constructor to somewhere else tho
*/

import { Game } from './game';

export function saveGameState(gameStateId: string, game: Game): void {
    let plainObjectMap: ObjectMap = new ObjectMap();

    let test = game.serialize();
    console.log(test);
}
export class ObjectMap {
    [s: string]: Object;
}
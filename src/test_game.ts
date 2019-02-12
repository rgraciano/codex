
// Until we build an API, we can initialize everything directly and test it here.
import { GameServer, Game } from './game';

var gs: GameServer = new GameServer();

console.log("New game state ID: " + gs.createNewGame());

console.log(gs.game.player1Board);


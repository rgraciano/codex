
console.log('hi');

// Until we build an API, we can initialize everything directly and test it here.
import { GameServer, Game } from './game';

console.log("hi?");
var gs: GameServer = new GameServer();

gs.createNewGame();

console.log(gs.game.player1Board);

// Until we build an API, we can initialize everything directly and test it here.
import { GameServer } from './game_server';

var gs: GameServer = new GameServer();

//console.log(gs.action('NewGame', {}));

testPlayCard(gs);

function testPlayCard(gs: GameServer) {
   // player 1 start state: L9YlsOq7Pr
    console.log(gs.action('PlayCard', { 'state': 'L9YlsOq7Pr', 'cardId': '6ZqGXSEruv' }));
}






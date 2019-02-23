
// Until we build an API, we can initialize everything directly and test it here.
import { GameServer } from './game_server';
import { saveGameState } from './serialize';

var gs: GameServer = new GameServer();

gs.action('NewGame', {});

saveGameState(gs.gameStateId, gs.game);

testPlayCard(gs);

function testPlayCard(gs: GameServer) {
   // player 1 start state: L9YlsOq7Pr
    console.log(gs.action('PlayCard', { 'state': 'L9YlsOq7Pr', 'cardId': '6ZqGXSEruv' }));
}






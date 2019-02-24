
// Until we build an API, we can initialize everything directly and test it here.
import { GameServer, ObjectMap } from './game_server';
import { Game } from './game';

var gs: GameServer = new GameServer();

//gs.action('NewGame', {});

//testSaveGameState(gs.gameStateId, gs.game);

//testPlayCard(gs);

testPlayArrivesCard(gs);

function testPlayCard(gs: GameServer) {
   // player 1 start state: oXSYI0NAdh, card  vpfLoJHbHU
    console.log(gs.action('PlayCard', { 'state': 'oXSYI0NAdh', 'cardId': 'vpfLoJHbHU' }));
}

function testPlayArrivesCard(gs: GameServer) {
    console.log(gs.action('PlayCard', { 'state': 'arrivesBeforePlay', 'cardId': 'arrivecard' }));
}


function testSaveGameState(gameStateId: string, game: Game): void {
    let plainObjectMap: ObjectMap = new ObjectMap();

    let test = game.serialize();
    let jsonified = JSON.stringify(test);
    let loaded = JSON.parse(jsonified);
    let newgame = Game.deserialize(loaded);

    console.log('post load');
}



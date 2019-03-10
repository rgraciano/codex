import { Request, Response, Next } from 'restify';
import * as corsMiddleware from 'restify-cors-middleware';
import * as restify from 'restify';
import { GameServer } from './game_server';

let gameServer = new GameServer();

function handleNewGame(req: Request, res: Response, next: Next) {
    let serializedGame = gameServer.action('NewGame', {});
    res.contentType = 'application/json';
    res.send(serializedGame);
    next();
}

/**
 * All Action requests are POST with two mandatory elements: actionName and state.
 * Other elements may be included as necessary, depending on what is needed by the action.
 * Each action will validate on its own.
 */
function handleAction(req: Request, res: Response, next: Next) {
    let context = req.body;

    let serializedGame: Object;

    if (req.body.actionName) {
        serializedGame = gameServer.action(req.body.actionName, context);
    } else serializedGame = { error: 'No action' };

    res.contentType = 'application/json';
    res.send(serializedGame);
    next();
}

let server = restify.createServer();

const cors = corsMiddleware({
    origins: ['*'],
    allowHeaders: ['X-Requested-With'],
    exposeHeaders: []
});
server.pre(cors.preflight);
server.use(cors.actual);
server.use(
    restify.plugins.bodyParser({
        maxBodySize: 1000000,
        mapParams: true,
        mapFiles: false,
        overrideParams: false,
        keepExtensions: false,
        multiples: false,
        rejectUnknown: true,
        reviver: JSON
    })
);

server.get('/newgame', handleNewGame);
server.post('/action', handleAction);
server.listen(8080, function() {
    console.log('%s listening at %s', server.name, server.url);
});

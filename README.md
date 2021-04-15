# codex

This is a prototype game server with enforced rules for Codex.  The React-TS client resides in a separate repository. The server is smart, and the client is very dumb / basic by design. The game server tells it everything - what to display, what actions to present, what targets are valid for the current actions possible, and so on.  The client just renders what it receives.  It has essentially no knowledge of rules whatsoever.

In this v0.1, we will be able to play a turn, generate forum output, and a link for the
other player to play their turn with current game state.  Multiple branches of a game
could be created by using the same link repeatedly (feature, not bug).  

If you're looking to get started, go to src/game_server.ts and begin from there.

To use this server, compile the TypeScript and then run the built index.js file:

tsc
node built/index.js

The server will then start up on local port 8080 by default, and you'll see a message that looks like:  "restify listening at http://[::]:8080".

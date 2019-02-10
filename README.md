# codex

This is a prototype client with enforced rules for Codex.

In this v0.1, we will be able to play a turn, generate forum output, and a link for the
other player to play their turn with current game state.  Multiple branches of a game
could be created by using the same link repeatedly (feature, not bug).  All of the game
code here is client code, and we'll build a thin TypeScrupt server (under "server/" someday)
to store the links and manage the state. 

v0.1 is client-only.  If we wanted to build client and server to start including anti-cheat
controls, we could refactor the code to look more like:

    engine/ (game state, turn validation code to be used by client and server)
    client/ (client-only code; includes most actions, etc)
    server/ (server-only code; validates client actions, stores state, etc)

Not sure what we'll actually build the client in yet.  React? Express? We'll just rock command
line for the moment in prototyping and worry about the rest later.
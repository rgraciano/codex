# codex

This is a prototype client with enforced rules for Codex.

In this v0.1, we will be able to play a turn, generate forum output, and a link for the
other player to play their turn with current game state.  Multiple branches of a game
could be created by using the same link repeatedly (feature, not bug).  

Initially I was going to build this as client-only, but now I'm thinking this will actually
be a thicker server and a thinner client.  There's a bit more up front work required to do this,
but long-term it'll work out.

Not sure what we'll actually build the client in yet, or exact format for client<->server interaction.  React and something like simple REST? We'll just rock command line for the moment in prototyping and worry about the rest later.

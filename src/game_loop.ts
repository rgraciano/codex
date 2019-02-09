

/** Setting up the game... */
var player1 = new Board(1);
var player2 = new Board(2);

// We will have to put in something to find starters etc later.  For now just give everyone the same starter
player1.discard = [new Tenderfoot(), new TimelyMessenger(), new OlderBrother(), 
                new FruitNinja(), new Tenderfoot(), new TimelyMessenger(),
                new OlderBrother(), new FruitNinja(), new Tenderfoot(), new TimelyMessenger()];

player2.discard = [new Tenderfoot(), new TimelyMessenger(), new OlderBrother(), 
                    new FruitNinja(), new Tenderfoot(), new TimelyMessenger(),
                    new OlderBrother(), new FruitNinja(), new Tenderfoot(), new TimelyMessenger()];


player1.drawCards(5);
player2.drawCards(5);

function beginTurn() {

}
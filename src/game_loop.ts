

player1.drawCards(5);
player2.drawCards(5);

function beginTurn(playerBoard: Board) {
    playerBoard.turnCount++;
    console.log("P" + playerBoard.playerNumber + "T" + playerBoard.turnCount);


}

import { EventDescriptor } from '../game';
import { Card } from '../cards/card';
import { CardApi } from '../cards/card_api';
import { Board } from 'board';

export function playCardAction(cardId: string, asWorker = false): void {
    let cardToPlay = Card.idToCardMap.get(cardId);
    if (!cardToPlay)
        throw new Error('Card ID ' + cardId + ' can not be found in hand');

    let game = cardToPlay.game;
    
    let boards = game.getBoardAndOpponentBoard();
    let board = boards[0];

    if (!game.cardIsInHand(board, cardToPlay))
        throw new Error('Card ID ' + cardId + ' can not be found in hand');

    if (asWorker)
        worker(board, cardToPlay)
    else
        play(board, cardToPlay)
}

function worker(board: Board, card: Card) {
    if (board.workeredThisTurn)
        throw new Error('You may only play a worker once per turn');

    if (board.gold < 1)
        throw new Error('Not enough gold to worker');

    board.gold--;

    card.game.addEvent(new EventDescriptor('PaidFor', 'Paid 1 gold to worker a card'));

    board.moveCard(board.hand, card, board.workers);
}

function play(board: Board, card: Card) {
    if (!card.canPlay()) 
        throw new Error(card.name + ' is not currently playable');

    let cost = card.effective().cost;
    board.gold -= cost;
    card.game.addEvent(new EventDescriptor('PaidFor', 'Paid ' + cost + ' gold for ' + card.name));

    // Takes card out of hand, but doesn't put it in play yet
    board.moveCard(board.hand, card);

    // TODO: Add spell support. Spells don't "arrive"
    CardApi.arriveCardIntoPlay(card);
}

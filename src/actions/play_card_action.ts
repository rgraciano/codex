import { EventDescriptor } from '../game';
import { Card } from '../cards/card';
import { CardApi } from '../cards/card_api';

export function playCardAction(cardId: string, asWorker = false): void {
    let cardToPlay = Card.idToCardMap.get(cardId);
    if (!cardToPlay) throw new Error('Card ID ' + cardId + ' can not be found in hand');

    let game = cardToPlay.game;

    let boards = game.getBoardAndOpponentBoard();
    let board = boards[0];

    if (!game.cardIsInHand(board, cardToPlay)) throw new Error('Card ID ' + cardId + ' can not be found in hand');

    if (asWorker) CardApi.worker(board, cardToPlay);
    else CardApi.play(board, cardToPlay, board.hand);
}

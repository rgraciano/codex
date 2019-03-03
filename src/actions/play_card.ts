
import { Game, EventDescriptor } from '../game';
import { Card } from '../cards/card';
import { CardApi } from '../cards/card_api';

export function playCardAction(game: Game, cardId: string): void {
    let boards = game.getBoardAndOpponentBoard();
    let board = boards[0];

    // first let's verify this card is in our hand currently
    let cardToPlay: Card = board.findCardById(board.hand, cardId);

    if (cardToPlay == undefined) {
        throw new Error('Card ID ' + cardId + ' can not be found in hand');
    }

    if (!cardToPlay.canPlay()) {
        throw new Error('Card ID ' + cardId + ' is not currently playable');
    }

    let attrs = cardToPlay.effective();
    board.gold -= attrs.cost;
    game.addEvent(new EventDescriptor('PaidFor', 'Paid ' + attrs.cost + ' gold for ' + cardToPlay.name));

    // Takes card out of hand, but doesn't put it in play yet
    board.moveCard(board.hand, cardToPlay);

    // TODO: Add spell support. Spells don't "arrive"
    CardApi.arriveCardIntoPlay(cardToPlay);
}


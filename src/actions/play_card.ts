
import { Game, EventDescriptor } from '../game';
import { Card, ArriveHandler, OpponentArriveHandler } from '../cards/card';
import { CardApi } from './card_api';

export function playCardAction(game: Game, cardId: string): void {
    let boards = game.getBoardAndOpponentBoard();
    let board = boards[0];

    // first let's verify this card is in our hand currently
    let cardToPlay: Card = board.findCardById(board.hand, cardId);

    if (cardToPlay == undefined) {
        throw new Error('Card ID ' + cardId + ' can not be found in hand');
    }

    let attrs = cardToPlay.effective();

    if (attrs.cost > board.gold) {
        throw new Error('This card costs too much!');
    }

    board.gold -= attrs.cost;
    game.addEvent(new EventDescriptor('PaidFor', 'Paid ' + attrs.cost + ' gold'));

    board.moveCard(board.hand, cardToPlay);

    // TODO: Add spell support. Spells don't "arrive"
    CardApi.cardArrivesInPlay(game, cardToPlay);
}

export function arriveChoiceAction(game: Game, cardId: string): void {
    let phase = game.phaseStack.topOfStack();

    if (phase.name != 'Arrive' || !phase.ifMustResolve(cardId)) {
        throw new Error('Arrive is not valid for ID ' + cardId);
    }

    phase.markResolved(cardId);

    let card: Card = Card.idToCardMap.get(cardId);

    if (card.controller == game.activePlayer) {
        game.addEvent((<ArriveHandler>card).onArrive(card));
    }
    else {
        game.addEvent((<OpponentArriveHandler>card).onOpponentArrive(card));
    }
}


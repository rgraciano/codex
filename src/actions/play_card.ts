
import { Game, EventDescriptor } from '../game';
import { Card, ArrivesHandler } from '../cards/card';
import { CardApi } from '../cards/card_api';

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
    game.addEvent(new EventDescriptor('PaidFor', 'Paid ' + attrs.cost + ' gold for ' + cardToPlay.name));

    // Takes card out of hand, but doesn't put it in play yet
    board.moveCard(board.hand, cardToPlay);

    // TODO: Add spell support. Spells don't "arrive"
    CardApi.arriveCardIntoPlay(cardToPlay);
}

export function arriveChoiceAction(game: Game, cardId: string): void {
    let phase = game.phaseStack.topOfStack();

    let mustResolveMap = phase.getMustResolveMapForCardId(cardId);

    if (phase.name != 'Arrives' || !mustResolveMap) {
        throw new Error('Arrives is not valid for ID ' + cardId);
    }

    phase.markResolved(cardId);

    let card: Card = Card.idToCardMap.get(cardId);
    game.addEvent((<ArrivesHandler>card).onArrives(Card.idToCardMap.get(mustResolveMap['arrivingCardId'])));
}


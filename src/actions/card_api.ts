
import { Game, EventDescriptor } from '../game';
import { Card } from '../cards/card';
import { Phase, findCardsToResolve } from './phase';

/**
 * Everything in here is designed to be called by a card when something happens, e.g., something is made to arrive.
 */
export class CardApi {

    static cardArrivesInPlay(game: Game, card: Card): void {
        let boards = game.getBoardAndOpponentBoard();
        let board = boards[0];
        let opponentBoard = boards[1];
    
        // First, apply any bonuses this card may get from other cards in play
        // TODO...

        // Second, enter the ARRIVES phase...
        game.phaseStack.addToStack(new Phase('Arrives', [ 'ArriveChoice' ]));

        let inPlayWithoutNewCard = board.inPlay;

        // Add the card to "in play"
        board.inPlay.push(card);

        // Add this card's "Arrives: ..." to the list of things to resolve
        findCardsToResolve(game, [ card ], 'onArrives');

        // Add any of my cards' "When <x> enters play, (do something)" to the list of things to resolve
        findCardsToResolve(game, inPlayWithoutNewCard.concat(board.getPatrolZoneAsArray(), board.effects), 'onAnotherArrives');

        // Add any of my opponents cards' "When an opponent's <x> enters play, (do something)" to the list of things to resolve.
        // I don't know any cards that actually do this, but implementing it here means it will technically be possible 
        findCardsToResolve(game, opponentBoard.inPlay.concat(opponentBoard.getPatrolZoneAsArray(), opponentBoard.effects), 'onOpponentArrives');

        // All done! If there's more than one event to resolve from the above, the user will be asked to choose the order.
    }
}
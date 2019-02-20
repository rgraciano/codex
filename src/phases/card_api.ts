
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
    
        // Card is added to the set of in play cards
        board.inPlay.push(card);
        game.addEvent(new EventDescriptor('Arrives', card.name + ' arrives'));
    
        // Next we need to check OnArrives for this card, onArrive for our cards, and onOpponentArrive for our opponent's cards.
        game.phaseStack.addToStack(new Phase('Arrive', [ 'ArriveChoice' ]));
        findCardsToResolve(game, board.inPlay.concat(board.getPatrolZoneAsArray(), board.effects), 'onArrive');
        findCardsToResolve(game, opponentBoard.inPlay.concat(opponentBoard.getPatrolZoneAsArray(), opponentBoard.effects), 'onOpponentArrive');
    }
}
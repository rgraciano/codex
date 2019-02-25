
import { Game } from '../game';
import { Card, GlobalBonusGiver } from '../cards/card';
import { Phase } from './phase';

/**
 * Everything in here is designed to be called by a card when something happens, e.g., something is made to arrive.
 */
export class CardApi {

    /** When you want something to arrive in play, use this */
    static cardArrivesInPlay(game: Game, card: Card): void {
        let boards = game.getBoardAndOpponentBoard();
        let board = boards[0];
        let opponentBoard = boards[1];
    

        /**** GLOBAL BONUSES ****/
        // First, check if this card applies bonuses to other cards (possibly including or excluding self)
        if (Reflect.has(card, 'giveBonus'))
            game.getAllActiveCards().map(boardCard => (<GlobalBonusGiver>card).giveBonus(boardCard));
        
        // Second, check if this card GETS bonuses FROM other cards...
        let bonusGivers = <GlobalBonusGiver[]>(Game.findCardsWithHandlers(game.getAllActiveCards(), 'giveBonus'));
        bonusGivers.map(giver => giver.giveBonus(card));


        /**** CARD IS NOW ON THE BOARD */
        board.inPlay.push(card);


        /**** ARRIVES PHASE ****/
        game.phaseStack.addToStack(new Phase('Arrives', [ 'ArriveChoice' ]));

        // Resolve any handlers that happen when a card arrives
        game.markMustResolveForHandlers(game.getAllActiveCards(), 'onArrives', map => { map['arrivingCardId'] = card.cardId; return map; });
    }

    static cardDies() {
        // set damage == health as we can always tell something is dead that way. this ensures something always "dies" in the correct way

        // look for onDies on this card to trigger

        // look for anotherDies  

        // rememember to check if bonus giver, and to call the removeBonus function accordingly
    }
}
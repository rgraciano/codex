
import { Game } from '../game';
import { Board } from '../board';
import { Card, GlobalBonusHook } from '../cards/card';
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
            game.getAllActiveCards().map(boardCard => (<GlobalBonusHook>card).giveBonus(boardCard));
        
        // Second, check if this card GETS bonuses FROM other cards...
        let bonusGivers = <GlobalBonusHook[]>(Game.findCardsWithHandlers(game.getAllActiveCards(), 'giveBonus'));
        bonusGivers.map(giver => giver.giveBonus(card));


        /**** CARD IS NOW ON THE BOARD */
        board.inPlay.push(card);


        /**** ARRIVES PHASE ****/
        game.phaseStack.addToStack(new Phase('Arrives', [ 'ArriveChoice' ]));

        // Resolve any handlers that happen when a card arrives
        game.markMustResolveForHandlers(game.getAllActiveCards(), 'onArrives', map => { map['arrivingCardId'] = card.cardId; return map; });
    }

    static cardDies(game: Game, card: Card) {
        // Set damage equal to health, as we can always tell something is dead that way. This is in case someone calls this method directly, e.g. by destroying a card
        card.attributeModifiers.damage = card.effective().health;

        /**** WOULD DIE ****/
        // We run all 'would die' handlers right away, because the user doesn't get to choose anything.  They just happen.  Order really does not matter.
        let wouldDieHooks = Game.findCardsWithHandlers(game.getAllActiveCards(), 'wouldDie');

        // look for wouldDie, have wouldDie do its thing. sometimes wouldDie will remove all attachments, e.g. as Indestructible does, in which case we'll need a function to do that.
        //     other times, wouldDie might only remove the soul stone or whatever is keeping it alive.


        // if we see that health is >0 and damage doesnt kill this, then don't die! leave here

        // ... if not, we ded. look for onDies and trigger those things. attachments like Spirit of the Panda should have an OnDies that detects their attachment died, and then remove themselves
        // from the game accordingly.

        // trigger any bonuses from ondies, e.g. patrol zone stuff

        // rememember to check if bonus giver, and to call the removeBonus function accordingly

        // call leavePlay with destination
    }

    static cardLeavesPlay(card: Card, destination: Destination) {
        // call any leaves play handlers
        // move card to destination
    }

    /** Resets a card and sends it to the discard pile */
    static discardCard(card: Card, game: Game): void {
        card.resetCard();
        game.removeCardFromPlay(card);
        
        let ownerBoard: Board = card.owner == 1 ? game.player1Board : game.player2Board;
        ownerBoard.discard.push(card);
    }
}
type Destination = 'Nowhere' | 'Hand' | 'Discard' | 'HeroZone';
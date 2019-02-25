
import { Game, EventDescriptor } from '../game';
import { Board } from '../board';
import { Card, GlobalBonusHook, WouldDieHook, WouldDiscardHook } from '../cards/card';
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
        let bonusGivers = <GlobalBonusHook[]>(Game.findCardsWithFunction(game.getAllActiveCards(), 'giveBonus'));
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
        let effective = card.effective();
        if (effective.damage < effective.health)
            card.attributeModifiers.damage = effective.health;

        /**** WOULD DIE ****/
        // We run all 'would die' handlers right away, because the user doesn't get to choose anything.  They just happen.  Order really does not matter.
        let wouldDieHooks = Game.findCardsWithFunction(game.getAllActiveCards(), 'wouldDie');

        wouldDieHooks.map(cardWithHook => {
            let descriptor = (<WouldDieHook>cardWithHook).wouldDie(card);
            game.addEvent(descriptor);
            return descriptor;
        });

        // After the hooks are run, we again check whether or not this should die
        effective = card.effective();
        if (effective.health > 0 && effective.damage < effective.health) {
            return;
        }

       
        /**** DEAD. SO DEAD. ****/
        game.phaseStack.addToStack(new Phase('Dies', [ 'DiesChoice' ]));
        game.markMustResolveForHandlers(game.getAllActiveCards(), 'onDies', map => { map['dyingCardId'] = card.cardId; return map; });

        CardApi.discardCard(card, game);

        let board = card.controller == 1 ? game.player1Board : game.player2Board;
        if (board.patrolZone.scavenger === card) {
            board.gold++;
            game.addEvent(new EventDescriptor('Scavenger', 'Player ' + card.controller + ' gains 1 gold for Scavenger'));
        }
        else if (board.patrolZone.technician === card) {
            board.drawCards(1);
            game.addEvent(new EventDescriptor('Technician', 'Player ' + card.controller + ' draws 1 card for Technician'));
        }
        // call leavePlay with destination
    }

    static cardLeavesPlay(card: Card, destination: Destination) {
        // call any leaves play handlers
        // move card to destination
    }

    /** Resets a card and sends it to the discard pile.  On the way, this card may be captured by Graveyard */
    static discardCard(card: Card, game: Game): void {
        card.resetCard();
        game.removeCardFromPlay(card);

        let wouldDiscardHooks = Game.findCardsWithFunction(game.getAllActiveCards(), 'wouldDiscard');
        let needToDiscard = true;

        if (wouldDiscardHooks) {
            wouldDiscardHooks.map(hookCard => {
                let result = (<WouldDiscardHook>hookCard).wouldDiscard(card);
               
                if (result) {
                    game.addEvent(result);
                    needToDiscard = false;
                }   
            });
        }

        if (needToDiscard) {
            let ownerBoard: Board = card.owner == 1 ? game.player1Board : game.player2Board;
            ownerBoard.discard.push(card);
        }
    }
}
type Destination = 'Nowhere' | 'Hand' | 'Discard' | 'HeroZone';
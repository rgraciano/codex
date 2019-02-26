
import { Game, EventDescriptor } from '../game';
import { Card, Hero, GlobalBonusHook, WouldDieHook, WouldDiscardHook } from './card';
import { Phase } from '../actions/phase';

/**
 * Everything in here is designed to be called by a card when something happens, e.g., something is made to arrive.
 */
export class CardApi {

    /** Does everything needed to bring a card into play. Note you still need to remove card from wherever it was before calling this */
    static arriveCardIntoPlay(card: Card): void {
        let boards = card.game.getBoardAndOpponentBoard();
        let board = boards[0];
        let opponentBoard = boards[1];
    
        /**** GLOBAL BONUSES ****/
        // First, check if this card applies bonuses to other cards (possibly including or excluding self)
        if (Reflect.has(card, 'giveBonus'))
            card.game.getAllActiveCards().map(boardCard => (<GlobalBonusHook>card).giveBonus(boardCard));
        
        // Second, check if this card GETS bonuses FROM other cards...
        let bonusGivers = <GlobalBonusHook[]>(Game.findCardsWithFunction(card.game.getAllActiveCards(), 'giveBonus'));
        bonusGivers.map(giver => giver.giveBonus(card));


        /**** CARD IS NOW ON THE BOARD */
        board.inPlay.push(card);


        /**** ARRIVES PHASE ****/
        card.game.phaseStack.addToStack(new Phase('Arrives', [ 'ArriveChoice' ]));

        // Resolve any handlers that happen when a card arrives
        card.game.markMustResolveForHandlers(card.game.getAllActiveCards(), 'onArrives', map => { map['arrivingCardId'] = card.cardId; return map; });
    }

    /** Does everything needed to destroy a card.  Triggers Dies, Leaves Play, & Would Discard. */
    static destroyCard(card: Card) {
        let game: Game = card.game;

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
        game.phaseStack.addToStack(new Phase('DiesOrLeaves', [ 'DiesOrLeavesChoice' ]));
        game.markMustResolveForHandlers(game.getAllActiveCards(), 'onDies', map => { map['dyingCardId'] = card.cardId; return map; });

        CardApi.discardCardFromPlay(card);

        let board = card.controller == 1 ? game.player1Board : game.player2Board;
        if (board.patrolZone.scavenger === card) {
            board.gold++;
            game.addEvent(new EventDescriptor('Scavenger', 'Player ' + card.controller + ' gains 1 gold for Scavenger'));
        }
        else if (board.patrolZone.technician === card) {
            board.drawCards(1);
            game.addEvent(new EventDescriptor('Technician', 'Player ' + card.controller + ' draws 1 card for Technician'));
        }
        
        // We already discarded this card, as we needed to do so to make the Technician work, so we set destination to 'Nowhere' as the card has been moved already
        this.leavePlay(card, 'Nowhere', true);
    }

    /** Called specifically when a card leaves play, such as when Undo is used to bounce a card to hand */
    static leavePlay(card: Card, destination: Destination, afterDies = false) {
        let game: Game = card.game;

        if (!afterDies)
            game.phaseStack.addToStack(new Phase('DiesOrLeaves', [ 'DiesOrLeavesChoice' ]));

        game.markMustResolveForHandlers(game.getAllActiveCards(), 'onLeaves', map => { map['leavingCardId'] = card.cardId; return map; });

        switch (destination) {
            case 'Hand':
                this.putCardBackInHand(card);
                break;
            case 'Discard':
                this.discardCardFromPlay(card);
                break;
            case 'HeroZone':
                this.putCardBackInHeroZone(<Hero>card);
                break;
            default:
                return;            
        }
    }

    /** Will NOT trigger leaves play and similar handlers.  Is supposed to be called directly by that sort of thing */
    private static putCardBackInHeroZone(card: Hero, justDied = false) {
        card.resetCard();
        card.justDied = justDied;
        card.game.removeCardFromPlay(card);
        card.ownerBoard.heroZone.push(card);
        card.game.addEvent(new EventDescriptor('ReturnToHeroZone', card.name + " was returned to hero zone", { cardId: card.cardId }));
    }

    /** Will NOT trigger leaves play and similar handlers. Call those if you want those things to happen. */
    private static putCardBackInHand(card: Card) {
        card.resetCard();
        card.game.removeCardFromPlay(card);
        card.ownerBoard.hand.push(card);
        card.game.addEvent(new EventDescriptor('PutInHand', card.name + " was returned to hand", { cardId: card.cardId }));
    }

    /** 
     * Does not trigger Dies or Leaves Play.  Use those functions if you want to initiate those things.
     * DOES trigger wouldDiscard, and looks for things that would prevent discard.
     */
    private static discardCardFromPlay(card: Card): void {
        card.resetCard();
        card.game.removeCardFromPlay(card);

        let wouldDiscardHooks = Game.findCardsWithFunction(card.game.getAllActiveCards(), 'wouldDiscard');
        let needToDiscard = true;

        if (wouldDiscardHooks) {
            wouldDiscardHooks.map(hookCard => {
                let result = (<WouldDiscardHook>hookCard).wouldDiscard(card);
               
                if (result) {
                    card.game.addEvent(result);
                    needToDiscard = false;
                }   
            });
        }

        if (needToDiscard) {
            card.ownerBoard.discard.push(card);
            card.game.addEvent(new EventDescriptor('DiscardedCards', card.name + " was discarded", { cardId: card.cardId }));
        }
    }
}
type Destination = 'Nowhere' | 'Hand' | 'Discard' | 'HeroZone';
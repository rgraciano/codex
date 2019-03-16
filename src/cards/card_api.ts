import { Game, EventDescriptor } from '../game';
import { Card, Hero } from './card';
import { GlobalBonusHook, WouldDieHook, WouldDiscardHook } from './handlers';
import { Phase, PhaseName, ActionName, PrimitiveMap } from '../actions/phase';
import { Board } from '../board';

type SpaceType = 'AllActive' | 'PlayerActive' | 'OpponentActive' | 'AllPatroller' | 'OpponentPatroller';
/**
 * Everything in here is designed to be called by a card when something happens, e.g., something is made to arrive.
 *
 * We use this because there are many ways in which calling the game state, board, or cards directly can screw something
 * up - like you might forget to trigger a bunch of things that should happen or handle an edge case or whatever -
 * so we put all typical "manipulate game state" functionality in here to provide one place to handle all of those things.
 */
export class CardApi {
    /** Does everything needed to bring a card into play. Note you still need to remove card from wherever it was before calling this */
    static arriveCardIntoPlay(card: Card, fromSpace: Card[]): void {
        let boards = card.game.getBoardAndOpponentBoard();
        let board = boards[0];
        let opponentBoard = boards[1];

        // Takes card out of hand, but doesn't put it in play yet
        this.removeCardFromSpace(board.hand, card);

        /**** GLOBAL BONUSES ****/
        // First, check if this card applies bonuses to other cards (possibly including or excluding self)
        if (Reflect.has(card, 'giveBonus')) card.game.getAllActiveCards().map(boardCard => (<GlobalBonusHook>card).giveBonus(boardCard));

        // Second, check if this card GETS bonuses FROM other cards...
        let bonusGivers = <GlobalBonusHook[]>this.findCardsWithProperty(card.game.getAllActiveCards(), 'giveBonus');
        bonusGivers.map(giver => card.game.addEvent(giver.giveBonus(card)));

        /**** CARD IS NOW ON THE BOARD */
        board.inPlay.push(card);

        /**** ARRIVES PHASE ****/
        this.trigger(card.game, 'Arrives', 'ArrivesChoice', 'onArrives', 'AllActive', { arrivingCardId: card.cardId });
    }

    /** Does everything needed to destroy a card.  Triggers Dies, Leaves Play, & Would Discard. */
    static destroyCard(card: Card) {
        let game: Game = card.game;

        // Set damage equal to health, as we can always tell something is dead that way. This is in case someone calls this method directly, e.g. by destroying a card
        let effective = card.effective();
        if (effective.damage < effective.health) card.attributeModifiers.damage = effective.health;

        /**** WOULD DIE ****/
        // We run all 'would die' hooks right away, because the user doesn't get to choose anything.  They just happen.  Order really does not matter.
        this.hook(game, 'wouldDie', [card]);

        // After the hooks are run, we again check whether or not this should die
        effective = card.effective();
        if (effective.health > 0 && effective.damage < effective.health) {
            return;
        }

        /**** DEAD. SO DEAD. ****/
        this.trigger(game, 'DiesOrLeaves', 'DiesOrLeavesChoice', 'onDies', 'AllActive', { dyingCardId: card.cardId });
        this.leavePlay(card, 'Discard', false, true); // TODO: Add Hero logic, which may also necessitate player choices
    }

    /** Called specifically when a card leaves play, such as when Undo is used to bounce a card to hand */
    static leavePlay(card: Card, destination: Destination, enterNewPhase: boolean, isDying: boolean) {
        let game: Game = card.game;

        let skipPhaseCreationIfExists: boolean = !enterNewPhase;
        if (enterNewPhase) {
            game.phaseStack.addToStack(new Phase('DiesOrLeaves', ['DiesOrLeavesChoice']));
            game.phaseStack.topOfStack().extraState.dyingCardId = card.cardId;
        }

        this.trigger(
            game,
            'DiesOrLeaves',
            'DiesOrLeavesChoice',
            'onLeaves',
            'AllActive',
            { dyingCardId: card.cardId },
            skipPhaseCreationIfExists
        );

        switch (destination) {
            case 'Hand':
                this.putCardBackInHand(card);
                break;
            case 'Discard':
                this.discardCardFromPlay(card, isDying);
                break;
            case 'HeroZone':
                this.putCardBackInHeroZone(<Hero>card);
                break;
            default:
                return;
        }
    }

    static checkWorkersAreFree(playerBoard: Board): boolean {
        return this.findCardsWithProperty(playerBoard.inPlay, 'workersAreFree').length > 0;
    }

    static worker(board: Board, card: Card) {
        if (!board.canWorker()) {
            throw new Error('You do not meet the requirements to worker');
        }

        let cost = board.getWorkerCost();
        board.gold -= cost;

        card.game.addEvent(new EventDescriptor('PaidFor', 'Paid ' + cost + ' gold to worker a card'));

        this.moveCard(board.hand, card, board.workers);
        board.workeredThisTurn = true;
    }

    static play(board: Board, card: Card, fromSpace: Card[], free = false) {
        if (!card.canPlay()) throw new Error(card.name + ' is not currently playable');

        if (!free) {
            let cost = card.effective().cost;
            board.gold -= cost;
            card.game.addEvent(new EventDescriptor('PaidFor', 'Paid ' + cost + ' gold for ' + card.name));
        }

        card.gainProperty('arrivalFatigue', 1);

        // TODO: Add spell support. Spells don't "arrive"
        CardApi.arriveCardIntoPlay(card, fromSpace);
    }

    /** Hooks happen immediately; no user choice is possible or necessary */
    static hook(game: Game, triggerFn: string, argsForTriggerFn: any[], hookSpace: SpaceType = 'AllActive') {
        let hooks = this.findCardsWithProperty(this.getCardsFromSpace(game, hookSpace), triggerFn);

        hooks.map(cardWithHook => {
            game.addEvent((<Function>Reflect.get(cardWithHook, triggerFn)).apply(argsForTriggerFn));
        });
    }

    /** Triggers will enter a new phase, in which the user may have to choose between which trigger happens first */
    static trigger(
        game: Game,
        phaseName: PhaseName,
        actionName: ActionName,
        triggerFn: string,
        triggerSpace: SpaceType = 'AllActive',
        extraState?: PrimitiveMap,
        skipPhaseCreationIfExists = false
    ) {
        let phase: Phase = undefined;

        if (skipPhaseCreationIfExists) {
            let topOfStack = game.phaseStack.topOfStack();
            if (topOfStack.name == phaseName) phase = topOfStack;
        }

        if (phase === undefined) phase = new Phase(phaseName, [actionName]);

        if (extraState) phase.extraState = extraState;

        let space: Card[] = this.getCardsFromSpace(game, triggerSpace);

        let foundCards: Card[] = this.findCardsWithProperty(space, triggerFn);
        // add all of those cards to the list of allowedActions, automatically removing those that were already resolved and ensuring there are no duplicates
        phase.markCardsToResolve(foundCards, triggerFn);
    }

    private static getCardsFromSpace(game: Game, spaceType: SpaceType): Card[] {
        let space: Card[] = [];
        switch (spaceType) {
            case 'AllActive':
                space = game.getAllActiveCards();
                break;
        }
        return space;
    }

    /**
     * Searches an array of cards for every card mapping to an interface (eg, implements onUpkeep). For example, findCardsWithHandlers(board.InPlay, 'onUpkeep')
     *
     * @param implementsFunction The function on an interface that would indicate this interface is implemented, eg, 'onUpkeep'
     */
    private static findCardsWithProperty(cards: Card[], implementsProperty: string): Card[] {
        return this.findCardsMatching(cards, card => Reflect.has(card, implementsProperty));
    }

    private static findCardsMatching(cards: Card[], matching: (card: Card) => boolean): Card[] {
        return cards.filter(card => {
            return card && matching(card);
        });
    }

    private static removeCardFromPlay(card: Card) {
        let game: Game = card.game;
        let found = false;

        if (!this.removeCardFromBoard(game.player1Board, card)) found = this.removeCardFromBoard(game.player2Board, card);
        else found = true;

        if (!found) throw new Error('Tried to remove ' + card.cardId + ' from play, but could not find it');
    }

    private static removeCardFromBoard(board: Board, card: Card): boolean {
        for (let i in board.patrolZone) {
            if (board.patrolZone[i] == card) {
                board.patrolZone[i] = null;
                return true;
            }
        }

        if (this.removeCardFromSpace(board.inPlay, card)) return true;
        if (this.removeCardFromSpace(board.effects, card)) return true;
        if (this.removeCardFromSpace(board.hand, card)) return true;

        return false;
    }

    private static removeCardFromSpace(space: Card[], card: Card): boolean {
        let index = space.findIndex(curCard => curCard == card);
        if (index >= 0) {
            space.splice(index, 1);
            return true;
        } else return false;
    }

    /**
     *  Moves a card from one area to another, e.g. hand to play space, play to discard, etc.
     *  If toSpace is omitted then the card is simply removed.
     */
    private static moveCard(fromSpace: Array<Card>, card: Card, toSpace?: Array<Card>) {
        this.removeCardFromSpace(fromSpace, card);
        if (toSpace) toSpace.push(card);
    }

    /** Will NOT trigger leaves play and similar handlers.  Is supposed to be called directly by that sort of thing */
    private static putCardBackInHeroZone(card: Hero) {
        card.resetCard();
        this.removeCardFromPlay(card);
        card.ownerBoard.heroZone.push(card);
        card.game.addEvent(new EventDescriptor('ReturnToHeroZone', card.name + ' was returned to hero zone', { cardId: card.cardId }));
    }

    /** Will NOT trigger leaves play and similar handlers. Call those if you want those things to happen. */
    private static putCardBackInHand(card: Card) {
        card.resetCard();
        this.removeCardFromPlay(card);
        card.ownerBoard.hand.push(card);
        card.game.addEvent(new EventDescriptor('PutInHand', card.name + ' was returned to hand', { cardId: card.cardId }));
    }

    /**
     * Does not trigger Dies or Leaves Play.  Use those functions if you want to initiate those things.
     * DOES trigger wouldDiscard, and looks for things that would prevent discard.
     */
    private static discardCardFromPlay(card: Card, isDying: boolean): void {
        card.resetCard();

        if (isDying) {
            let board = card.controller == 1 ? card.game.player1Board : card.game.player2Board;
            if (board.patrolZone.scavenger === card) {
                board.gold++;
                card.game.addEvent(new EventDescriptor('Scavenger', 'Player ' + card.controller + ' gains 1 gold for Scavenger'));
            } else if (board.patrolZone.technician === card) {
                board.drawCards(1);
                card.game.addEvent(new EventDescriptor('Technician', 'Player ' + card.controller + ' draws 1 card for Technician'));
            }
        }

        this.removeCardFromPlay(card);

        // this should use hook(), but it's a weird hook because we have to look at the return values for this one
        let wouldDiscardHooks = this.findCardsWithProperty(card.game.getAllActiveCards(), 'wouldDiscard');
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
            card.game.addEvent(new EventDescriptor('DiscardedCards', card.name + ' was discarded', { cardId: card.cardId }));
        }
    }
}
type Destination = 'Nowhere' | 'Hand' | 'Discard' | 'HeroZone';

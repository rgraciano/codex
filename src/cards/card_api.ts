import { Game, EventDescriptor } from '../game';
import { Card } from './card';
import { Hero } from './hero';
import { Spell, AttachSpell, ImmediateSpell, OngoingSpell, UntilSpell } from './spell';
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
    static arriveCardIntoPlay(card: Card, fromSpace: Card[], toPlayerBoard: boolean = true): void {
        let [playerBoard, opponentBoard] = card.game.getBoardAndOpponentBoard();
        let board = toPlayerBoard ? playerBoard : opponentBoard;

        // Takes card out of hand, but doesn't put it in play yet
        this.removeCardFromSpace(fromSpace, card);

        card.gainProperty('arrivalFatigue', 1);

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
        if (effective.damage < card.allHealth) card.attributeModifiers.damage = card.allHealth;

        /**** WOULD DIE ****/
        // We run all 'would die' hooks right away, because the user doesn't get to choose anything.  They just happen.  Order really does not matter.
        this.hook(game, 'wouldDie', [card]);

        // After the hooks are run, we again check whether or not this should die
        effective = card.effective();
        if (card.allHealth > 0 && effective.damage < card.allHealth) {
            return;
        }

        /**** DEAD. SO DEAD. ****/
        this.trigger(game, 'DiesOrLeaves', 'DiesOrLeavesChoice', 'onDies', 'AllActive', { dyingCardId: card.cardId });
        this.leavePlay(card, 'Discard', false, true);
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
                this.putCardBackInHeroZone(<Hero>card, isDying);
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

        this.moveCard(card, board.hand, board.workers);
        board.workeredThisTurn = true;
    }

    static play(board: Board, card: Card, fromSpace: Card[], free = false) {
        if (!card.canPlay()) throw new Error(card.name + ' is not currently playable');

        if (!free) {
            let cost = card.effective().cost;
            board.gold -= cost;
            card.game.addEvent(new EventDescriptor('PaidFor', 'Paid ' + cost + ' gold for ' + card.name));
        }

        // Before cards arrive, they go into the "Play Staging Area", where the user can choose which thing to do on the card.
        // Most of the time, there will only be one thing to do and this stage will auto-resolve without the user needing
        // to make any choices.  But for some spells, and when Boost / Don't Boost are there, then the user has to choose what to do
        // next.
        if (card.stagingAbilityMap.size > 1) {
            let phase = new Phase('Staging', ['StagingAbility'], false);
            phase.markCardsToResolve([card]);
            card.game.phaseStack.addToStack(phase);
            this.moveCard(card, fromSpace, board.playStagingArea);
        } else {
            this.leaveStagingArea(card, fromSpace);
        }
    }

    static leaveStagingArea(card: Card, fromSpace: Card[]) {
        // spells either have a default 'Cast' ability, OR they have a set of abilities to choose from in playStagingArea.
        //
        // once we're out of the staging area - either because they chose something and moved forward, or because there was nothing
        // choose (only a default), we end up here.
        if (card.cardType == 'Spell') {
            let spell: Spell = <Spell>card;

            switch (spell.spellLifecycle) {
                case 'Attachment':
                    let attachment = <AttachSpell>card;
                    attachment.attachAbility.use(); // enters phase and resolves as if this was an ability
                    this.moveCard(attachment, fromSpace, card.controllerBoard.inPlay); // move into play now, b/c this is really complicated otherwise...
                    return;

                case 'Immediate':
                    let immediate = <ImmediateSpell>card;
                    immediate.castAbility.use();
                    this.moveCard(immediate, fromSpace, immediate.ownerBoard.discard);
                    return;

                case 'MultipleChoice':
                    // don't need to cast, since this was done by play_staging_ability_action
                    this.moveCard(card, fromSpace, card.ownerBoard.discard);
                    return;

                case 'Ongoing':
                    let ongoing = <OngoingSpell>card;
                    ongoing.enterPlay(); // might be empty, depending on the spell
                    this.moveCard(ongoing, fromSpace, ongoing.controllerBoard.inPlay);
                    return;

                case 'UntilEndOfTurn':
                case 'UntilNextTurn':
                    let untilSpell = <UntilSpell>card;
                    untilSpell.enterPlay(); // might be empty, depending on the spell...
                    untilSpell.controllerBoard.activeSpells.push(untilSpell); // add spell to current ongoing effects
                    this.moveCard(ongoing, fromSpace, ongoing.ownerBoard.discard);
                    return;
            }
        } else {
            CardApi.arriveCardIntoPlay(card, fromSpace);
        }
    }

    /**
     * Hooks happen immediately; no user choice is possible or necessary
     * @returns whether or not a hook activated
     */
    static hook(game: Game, triggerFn: string, argsForTriggerFn: any[], hookSpace: SpaceType = 'AllActive'): boolean {
        let hooks = this.findCardsWithProperty(this.getCardsFromSpace(game, hookSpace), triggerFn);

        let atLeastOneHookActivated = false;

        hooks.map(cardWithHook => {
            game.addEvent((<Function>Reflect.get(cardWithHook, triggerFn)).apply(argsForTriggerFn));
            atLeastOneHookActivated = true;
        });

        return atLeastOneHookActivated;
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

    static makeTokens(game: Game, tokenName: string, numTokens: number, onMyBoard: boolean = true) {
        let [playerBoard, opponentBoard] = game.getBoardAndOpponentBoard();
        let board = onMyBoard ? playerBoard : opponentBoard;

        let ns = require(<string>'./test/' + <string>tokenName + '.js');

        let card: Card;
        for (let i = 0; i < numTokens; i++) {
            card = new ns[<string>tokenName](board.playerNumber, board.playerNumber, Card.makeCardId());
            this.arriveCardIntoPlay(card, []);
        }
    }

    private static getCardsFromSpace(game: Game, spaceType: SpaceType): Card[] {
        let space: Card[] = [];
        switch (spaceType) {
            case 'AllActive':
                space = game.getAllActiveCards();
                break;
            case 'PlayerActive':
                space = game.getAllActiveCards(game.getBoardAndOpponentBoard()[0]);
                break;
            case 'OpponentActive':
                space = game.getAllActiveCards(game.getBoardAndOpponentBoard()[1]);
                break;
            case 'AllPatroller':
                space = game.getAllPatrollers();
                break;
            case 'OpponentPatroller':
                space = game.getAllPatrollers(game.getBoardAndOpponentBoard()[1]);
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
        if (this.removeCardFromSpace(board.activeSpells, card)) return true;
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
    private static moveCard(card: Card, fromSpace: Array<Card>, toSpace?: Array<Card>) {
        this.removeCardFromSpace(fromSpace, card);
        if (toSpace) toSpace.push(card);
    }

    /** Will NOT trigger leaves play and similar handlers.  Is supposed to be called directly by that sort of thing */
    private static putCardBackInHeroZone(card: Hero, preventSummonNextTurn = true) {
        card.resetCard();

        if (preventSummonNextTurn) card.markCantBeSummonedNextTurn();

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

        let preventedDiscard = this.hook(card.game, 'wouldDiscard', [card]);

        if (!preventedDiscard) {
            card.ownerBoard.discard.push(card);
            card.game.addEvent(new EventDescriptor('DiscardedCards', card.name + ' was discarded', { cardId: card.cardId }));
        }
    }
}
type Destination = 'Nowhere' | 'Hand' | 'Discard' | 'HeroZone';

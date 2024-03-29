import { Game, EventDescriptor } from '../game';
import { Card, Unit, Hero } from './card';
import { Spell, AttachSpell, ImmediateSpell, OngoingSpell, UntilSpell } from './spell';
import { GlobalBonusHook, WouldDieHook, WouldDiscardHook } from './handlers';
import { Phase, ActionName, PrimitiveMap, Action, ActionOptions } from '../actions/phase';
import { Board, PatrolZone, BoardBuilding } from '../board';

export type SpaceType = 'AllActive' | 'PlayerActive' | 'OpponentActive' | 'AllPatroller' | 'OpponentPatroller' | 'None';
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

        /**** GLOBAL BONUSES ****/
        // First, check if this card applies bonuses to other cards (possibly including or excluding self)
        if (Reflect.has(card, 'giveBonus')) card.game.getAllActiveCards().map(boardCard => (<GlobalBonusHook>card).giveBonus(boardCard));

        // Second, check if this card GETS bonuses FROM other cards...
        let bonusGivers = <GlobalBonusHook[]>this.findCardsWithProperty(card.game.getAllActiveCards(), 'giveBonus');
        bonusGivers.map(giver => card.game.addEvent(giver.giveBonus(card)));

        /**** CARD IS NOW ON THE BOARD */
        board.inPlay.push(card);
        card.gainProperty('arrivalFatigue', 1); // must happen after arriving on board, as cards won't gain properties if not active

        /**** ARRIVES PHASE ****/
        this.trigger(card.game, 'ArrivesChoice', 'onArrives', 'AllActive', { arrivingCardId: card.cardId });
    }

    /** Runs alteration to change amount of damage done, and trigger to see if anything else happens.
     * @returns amount of damage done after alterations
     */
    static dealDirectDamage(amount: number, damagedBy: Card, damageCard: Card, damageBuilding: BoardBuilding): number {
        let game = damagedBy.game;

        // check whether or not any cards in play alter the amount of damage being done
        let alteredDamage = this.hookOrAlteration(game, 'alterDamage', [damagedBy, damageCard, damageBuilding], 'AllActive').reduce(
            (p: number, c: number) => p + c,
            amount
        );
        let extraState: PrimitiveMap = { damagedBy: damagedBy.cardId, amount: alteredDamage };
        if (damageCard) {
            damageCard.gainProperty('damage', alteredDamage);
            extraState.damageCard = damageCard.cardId;
        } else if (damageBuilding) {
            damageBuilding.damage(alteredDamage, damagedBy);
            extraState.damageBuilding = damageBuilding.name;
        }

        // damage was done, trigger any 'onDirectDamage' effects if they exist
        this.trigger(game, 'DirectDamageChoice', 'onDirectDamage', 'AllActive', extraState);

        return alteredDamage;
    }

    /**
     * Does everything needed to destroy a card.  Triggers Dies, Leaves Play, & Would Discard.
     * @returns true if was actually destroyed, false if was saved by something
     */
    static destroyCard(card: Card, useExistingPhase = false): boolean {
        let game: Game = card.game;

        // Set damage equal to health, as we can always tell something is dead that way. This is in case someone calls this method directly, e.g. by destroying a card
        let effective = card.effective();
        if (effective.damage < card.allHealth) card.attributeModifiers.damage = card.allHealth;

        /**** WOULD DIE ****/
        // We run all 'would die' hooks right away, because the user doesn't get to choose anything.  They just happen.  Order really does not matter.
        this.hookOrAlteration(game, 'wouldDie', [card]);

        // After the hooks are run, we again check whether or not this should die
        effective = card.effective();
        if (card.allHealth > 0 && effective.damage < card.allHealth) {
            return false;
        }

        /**** DEAD. SO DEAD. ****/
        this.trigger(game, 'DiesChoice', 'onDies', 'AllActive', { dyingCardId: card.cardId }, useExistingPhase);

        if (card.cardType == 'Hero') {
            let phase = game.phaseStack.topOfStack();
            let action = new Action('HeroLevelChoice', { canChooseTargetsMoreThanOnce: false, chooseNumber: 1, mustChooseAll: false });
            action.addCards(
                game
                    .getAllActiveCards(card.oppControllerBoard)
                    .filter(opponentCard => opponentCard.cardType == 'Hero' && (<Hero>opponentCard).level < (<Hero>opponentCard).maxLevel)
            );

            if (action.countToResolve() > 0) phase.actions.push(action);

            this.leavePlay(card, 'HeroZone', true, true);
        } else this.leavePlay(card, 'Discard', true, true);

        return true;
    }

    /** Called specifically when a card leaves play, such as when Undo is used to bounce a card to hand */
    static leavePlay(card: Card, destination: Destination, useExistingPhase: boolean, isDying: boolean) {
        let game: Game = card.game;

        this.trigger(game, 'LeavesChoice', 'onLeaves', 'AllActive', { dyingCardId: card.cardId }, useExistingPhase);

        if (isDying) {
            let board = card.controllerBoard;
            if (board.patrolZone.scavenger === card) {
                board.gold++;
                card.game.addEvent(new EventDescriptor('Scavenger', 'Player ' + card.controller + ' gains 1 gold for Scavenger'));
            } else if (board.patrolZone.technician === card) {
                board.drawCards(1, card.game);
                card.game.addEvent(new EventDescriptor('Technician', 'Player ' + card.controller + ' draws 1 card for Technician'));
            }
        }

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

    static sidelineCard(cardToSideline: Card) {
        let patrolSlot = PatrolZone.getSlotNameForCard(cardToSideline.controllerBoard.patrolZone, cardToSideline);
        if (!patrolSlot) throw new Error('Cant find patrol slot for card');

        CardApi.removeCardFromPlay(cardToSideline);
        cardToSideline.controllerBoard.inPlay.push(cardToSideline);

        switch (patrolSlot) {
            case 'squadLeader':
                cardToSideline.attributeModifiers.armor--;
                break;
            case 'elite':
                cardToSideline.attributeModifiers.attack--;
                break;
            case 'lookout':
                cardToSideline.attributeModifiers.resist--;
                break;
        }

        CardApi.hookOrAlteration(cardToSideline.game, 'sideline', [patrolSlot], 'None', cardToSideline);
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

        // ensure that we reset this card before trying to play it, in case something weird happened
        // to it in the discard pile or wherever it was sitting. for example, a card hook that executes
        // on combat damage could change a card after it died, accidentally.  that would be a bug in the
        // card hook, but this makes the game a bit more resilient to dodge any such bugs
        card.resetCard();

        if (!free) {
            let cost: number = card.costAfterAlterations;
            board.gold -= cost > 0 ? cost : 0;
            card.game.addEvent(new EventDescriptor('PaidFor', 'Paid ' + cost + ' gold for ' + card.name));
        }

        // Before cards arrive, they go into the "Play Staging Area", where the user can choose which thing to do on the card.
        // Most of the time, there will only be one thing to do and this stage will auto-resolve without the user needing
        // to make any choices.  But for some spells, and when Boost / Don't Boost are there, then the user has to choose what to do
        // next.
        if (card.stagingAbilityMap.size > 1) {
            let action = new Action('StagingAbility', new ActionOptions()).registerNeverAutoResolve();
            let phase = new Phase([action]);
            action.addIds([card.cardId]);
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
     * @param singleCard if set, activate hook on this one card instead of searching hookSpace
     * @param hookSpace if singleCard is not set, then apply the hook to everything in this search space
     * @returns whether or not a hook activated
     */
    static hookOrAlteration(
        game: Game,
        triggerFn: string,
        argsForTriggerFn: any[],
        hookSpace: SpaceType = 'AllActive',
        singleCard?: Card
    ): any[] {
        let spaceCards = singleCard ? [singleCard] : this.getCardsFromSpace(game, hookSpace);
        let hooks = this.findCardsWithProperty(spaceCards, triggerFn);

        return hooks.map(cardWithHook => {
            Reflect.apply(Reflect.get(cardWithHook, triggerFn), cardWithHook, argsForTriggerFn);
        });
    }

    static hookOrAlterationSingleValue<T>(hookOrAlterationResult: any[], defaultValue: T): T {
        if (hookOrAlterationResult && hookOrAlterationResult.length > 0) return <T>hookOrAlterationResult[0];
        return defaultValue;
    }

    /** Triggers will enter a new phase, in which the user may have to choose between which trigger happens first */
    static trigger(
        game: Game,
        actionName: ActionName,
        triggerFn: string,
        triggerSpace: SpaceType = 'AllActive',
        extraState?: PrimitiveMap,
        useExistingPhase = false
    ) {
        let phase: Phase = undefined;
        let action: Action = new Action(actionName, { canChooseTargetsMoreThanOnce: false, chooseNumber: 0, mustChooseAll: true });

        if (useExistingPhase) {
            phase = game.phaseStack.topOfStack();
            phase.actions.push(action);
        } else {
            phase = new Phase([action]);
            game.phaseStack.addToStack(phase);
        }

        if (extraState) action.extraState = extraState;

        let space: Card[] = this.getCardsFromSpace(game, triggerSpace);

        let foundCards: Card[] = this.findCardsWithProperty(space, triggerFn);

        // add all of those cards to the list of allowedActions, automatically removing those that were already resolved and ensuring there are no duplicates
        if (foundCards.length > 0) phase.getAction(actionName).addCards(foundCards);
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

    public static getCardsFromSpace(game: Game, spaceType: SpaceType): Card[] {
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
            case 'None':
                space = [];
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

    public static removeCardFromPlay(card: Card) {
        let game: Game = card.game;
        let found = this.removeCardFromBoard(game.player1Board, card);
        if (!found) this.removeCardFromBoard(game.player2Board, card);
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

        this.removeCardFromPlay(card);

        let preventedDiscard = this.hookOrAlterationSingleValue(this.hookOrAlteration(card.game, 'wouldDiscard', [card]), false);

        if (!preventedDiscard && !(card.cardType == 'Unit' && (<Unit>card).isToken)) {
            card.ownerBoard.discard.push(card);
            card.game.addEvent(new EventDescriptor('DiscardedCards', card.name + ' was discarded', { cardId: card.cardId }));
        }
    }
}
type Destination = 'Nowhere' | 'Hand' | 'Discard' | 'HeroZone';

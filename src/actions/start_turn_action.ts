import { Game, EventDescriptor } from '../game';
import { Card } from '../cards/card';
import { Board } from '../board';
import { PatrolZone } from '../board';
import { Phase, Action } from './phase';
import { UpkeepHandler } from '../cards/handlers';
import { CardApi } from '../cards/card_api';

export function startTurnAction(game: Game): void {
    let boards = game.getBoardAndOpponentBoard();
    let board = boards[0];
    let opponentBoard = boards[1];

    board.turnCount++; // TODO: This needs to be done per player

    // clear any active spells that I have, since max duration is 'UntilNextTurn'
    board.activeSpells = [];

    // clear my opponent's spells, leaving only the 'Until Next Turn' ones alive (since those are still going on my turn)
    opponentBoard.activeSpells = opponentBoard.activeSpells.filter(spell => spell.spellLifecycle == 'UntilNextTurn');

    // clear patrol zone, moving everything to "in play"
    game.addEvent(clearPatrolZone(board));

    // ready everything
    game.addEvents(readyAllCards(game, board));

    // undo any armor damage. all armor resets on every turn
    game.getAllActiveCards().map(card => (card.attributeModifiers.armorDamageThisTurn = 0));

    // mark recently deceased heroes as being one turn closer to available,
    // and heroes that were max leveled as being able to cast ultimate
    board.heroZone.map(hero => hero.newTurn());

    // collect gold
    game.addEvent(board.collectGold());

    // reset tower ability
    if (board.addOn && board.addOn.addOnType == 'Tower') board.addOn.towerRevealedThisTurn = false;
    game.getAllActiveCards().map(card => (card.attributeModifiers.towerRevealedThisTurn = 0));

    // allow worker
    board.workeredThisTurn = false;

    // draw card for surplus
    if (board.addOnIsActive() && board.addOn.addOnType == 'Surplus') {
        board.drawCards(1);
        game.addEvent(new EventDescriptor('Draw', 'Drew a card for Surplus'));
    }

    // enter player turn phase
    game.phaseStack.addToStack(
        new Phase([
            new Action('PlayCard').registerNeverAutoResolve(),
            new Action('Worker').registerNeverAutoResolve(),
            new Action('Tech').registerNeverAutoResolve(),
            new Action('Build').registerNeverAutoResolve(),
            new Action('Patrol').registerNeverAutoResolve(),
            new Action('Ability').registerNeverAutoResolve(),
            new Action('Attack').registerNeverAutoResolve(),
            new Action('HeroLevel').registerNeverAutoResolve(),
            new Action('EndTurn').registerNeverAutoResolve(),
            new Action('TowerReveal').registerNeverAutoResolve(),
            new Action('Sideline').registerNeverAutoResolve()
        ])
    );

    // enter upkeep phase, process upkeep events. when this is resolved, we'll exit into the PlayerTurn phase just beneath
    CardApi.trigger(game, 'UpkeepChoice', 'onUpkeep', 'PlayerActive', {});
}

export function upkeepChoice(game: Game, card: Card): boolean {
    if (
        !game.phaseStack
            .topOfStack()
            .getAction('UpkeepChoice')
            .ifToResolve(card.cardId)
    )
        throw new Error('Invalid choice');
    game.addEvent((<UpkeepHandler>card).onUpkeep());
    return true;
}

function clearPatrolZone(board: Board) {
    let patrolSlot: keyof PatrolZone;

    for (patrolSlot in board.patrolZone) {
        let patroller: Card = board.patrolZone[patrolSlot];

        if (patroller) {
            board.inPlay.push(patroller);
            board.patrolZone[patrolSlot] = null;
            CardApi.hook(patroller.game, 'sideline', [patrolSlot], 'None', patroller);
        }
    }

    return new EventDescriptor('ClearPatrolZone', 'Cleared the patrol zone');
}

function readyAllCards(game: Game, board: Board): Array<EventDescriptor> {
    // Nothing happens when we ready cards, so we don't have to worry about any triggers happening here.

    let andDoToReadyCards = function(card: Card): EventDescriptor {
        if (card.attributeModifiers.exhausted > 0) card.attributeModifiers.exhausted--; // decrement because adding to this means it's disabled or may have come into play exhausted

        card.attributeModifiers.arrivalFatigue = 0; // set to zero because you have arrival fatigue or you don't
        return new EventDescriptor('ReadyCard', 'Readied ' + card.name, { cardId: card.cardId });
    };
    let matching = function(card: Card): boolean {
        let attrs = card.effective();
        return attrs.exhausted > 0 || attrs.arrivalFatigue > 0;
    };

    return Game.findAndDoOnCards(board.inPlay, matching, andDoToReadyCards);
}

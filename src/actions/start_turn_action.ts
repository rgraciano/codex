import { Game, EventDescriptor } from '../game';
import { Card } from '../cards/card';
import { Board } from '../board';
import { PatrolZone } from '../board';
import { UpkeepHandler } from '../cards/handlers';
import { CardApi } from '../cards/card_api';

export function startTurnAction(game: Game): void {
    let boards = game.getBoardAndOpponentBoard();
    let board = boards[0];
    let opponentBoard = boards[1];

    board.turnCount++;

    // clear any active spells that I have, since max duration is 'UntilNextTurn'
    board.activeSpells = [];

    // reset reshuffles this turn
    board.reshufflesThisTurn = 0;

    // clear my opponent's spells, leaving only the 'Until Next Turn' ones alive (since those are still going on my turn)
    opponentBoard.activeSpells = opponentBoard.activeSpells.filter(spell => spell.spellLifecycle == 'UntilNextTurn');

    // clear patrol zone, moving everything to "in play"
    if (board.turnCount > 1) game.addEvent(clearPatrolZone(board));

    // un-exhaust everything on the player's board
    game.getAllActiveCards(board).map(card => {
        if (card.attributeModifiers.exhausted > 0) card.attributeModifiers.exhausted--; // decrement because adding to this means it's disabled or may have come into play exhausted
    });

    // remove arrival fatigue from ALL cards, since the opponent may have some arrival fatigue.
    game.getAllActiveCards().map(card => {
        if (card.attributeModifiers.arrivalFatigue > 0) card.attributeModifiers.arrivalFatigue = 0;
    });

    // undo any armor damage. all armor resets on every turn
    game.getAllActiveCards().map(card => (card.attributeModifiers.damageToArmor = 0));

    // add up all healing abilities and heal friendly units & heroes
    let healing = 0;
    game.getAllActiveCards(board).map(card => (healing += card.effective().healing));
    game.getAllActiveCards(board).map(card => {
        if (card.cardType == 'Unit' || card.cardType == 'Hero') {
            let net = card.attributeModifiers.damage - healing;
            card.attributeModifiers.damage = net > 0 ? net : 0;
        }
    });
    if (healing > 0) game.addEvent(new EventDescriptor('Healing', 'Healed up to ' + healing + 'damage on units and heroes'));

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
    if (board.addOn.isActive() && board.addOn.addOnType == 'Surplus') {
        board.drawCards(1, game);
        game.addEvent(new EventDescriptor('Draw', 'Drew a card for Surplus'));
    }

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
            CardApi.hookOrAlteration(patroller.game, 'sideline', [patrolSlot], 'None', patroller);
        }
    }

    return new EventDescriptor('ClearPatrolZone', 'Cleared the patrol zone');
}

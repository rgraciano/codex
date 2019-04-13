import { Game, EventDescriptor } from '../game';
import { Phase, Action } from './phase';
import { CardApi } from '../cards/card_api';
import { startTurnAction } from './start_turn_action';

export function endTurnAction(game: Game): void {
    // Push cleanup phase onto the stack, so this will happen AFTER the EndTurnChoice triggers
    // The EndTurnCleanup action switches the active player and that sort of thing
    let action = new Action('EndTurnCleanup').registerEmptyActionForAutoResolve();
    let phase = new Phase([action]);
    game.phaseStack.addToStack(phase);

    // Draw/discard happens here, BEFORE EndTurnChoice. This is because a card like Bloodrage Ogre
    // is not supposed to be discarded by Draw/Discard
    let cardsDiscarded = game.playerBoard.discardHand();
    let cardsToDraw = cardsDiscarded + 2 > 5 ? 5 : cardsDiscarded + 2;
    game.playerBoard.drawCards(cardsToDraw, game, true);
    game.addEvent(new EventDescriptor('DiscardDraw', 'Discard ' + cardsDiscarded + ', draw ' + cardsToDraw));

    // This will trigger any "End of Turn" cards
    CardApi.trigger(game, 'EndTurnChoice', 'onEndTurn', 'AllActive');
}

export function endTurnCleanupAction(game: Game) {
    for (let building of game.playerBoard.buildings) building.finishBuilding();

    // Swap active player number
    game.activePlayer = game.activePlayer == 1 ? 2 : 1;

    // TODO: Print out forum-formatted everything that happened, along with a link to the next turn, instead of auto-starting the next turn
    startTurnAction(game);
}

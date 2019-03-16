import { Game, EventDescriptor } from '../game';
import { Phase } from './phase';

export function towerRevealAction(game: Game): void {
    let board = game.activePlayer == 1 ? game.player1Board : game.player2Board;

    if (!board.addOnIsActive() || !(board.addOn.addOnType == 'Tower') || board.addOn.towerRevealedThisTurn) {
        throw new Error('Reveal is not valid');
    }

    let eligibleCards = game.getAllActiveCards().filter(card => {
        let eff = card.effective();
        return (eff.invisible || eff.stealth) && !eff.towerRevealedThisTurn;
    });

    if (eligibleCards.length == 0) {
        game.addEvent(new EventDescriptor('TowerReveal', 'Nothing eligible for Tower reveal'));
        return;
    }

    let phase = new Phase('ChooseTowerReveal', ['TowerRevealChoice']);
    game.phaseStack.addToStack(phase);
    phase.markCardsToResolve(eligibleCards);

    board.addOn.towerRevealedThisTurn = true;
}

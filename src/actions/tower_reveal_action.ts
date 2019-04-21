import { Game, EventDescriptor } from '../game';
import { Phase, Action } from './phase';
import { Card } from '../cards/card';

export function towerRevealAction(game: Game): void {
    let board = game.activePlayer == 1 ? game.player1Board : game.player2Board;

    if (!board.addOn.isActive() || !(board.addOn.addOnType == 'Tower') || board.addOn.towerRevealedThisTurn) {
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

    let action = new Action('TowerRevealChoice', { canChooseTargetsMoreThanOnce: false, chooseNumber: 1, mustChooseAll: false });
    action.addCards(eligibleCards);
    game.phaseStack.addToStack(new Phase([action]));

    board.addOn.towerRevealedThisTurn = true;
}

export function chooseTowerRevealChoice(card: Card) {
    if (
        !card.game.phaseStack
            .topOfStack()
            .getAction('TowerRevealChoice')
            .ifToResolve(card.cardId)
    )
        throw new Error('Invalid choice');
    card.gainProperty('towerRevealedThisTurn');
    card.game.addEvent(new EventDescriptor('TowerReveal', 'Tower revealed ' + card.name));
    return true;
}

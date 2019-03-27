import { Card, Character } from '../cards/card';
import { Phase } from './phase';

export function patrolAction(cardId: string): void {
    let cardToPatrol = Card.idToCardMap.get(cardId);
    if (!cardToPatrol) throw new Error('Card ID ' + cardId + ' can not be found');

    if (!(cardToPatrol instanceof Character)) {
        throw new Error('Only characters can patrol');
    }

    let character = <Character>cardToPatrol;

    if (!character.canPatrol()) throw new Error('This character is unable to patrol');

    let phase = new Phase('ChoosePatrolSlot', ['PatrolChoice'], false);
    phase.extraState['patrolCardId'] = cardId;
    cardToPatrol.game.phaseStack.addToStack(phase);
}

export function stopPatrollingAction(cardId: string): void {}

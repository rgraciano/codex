import { Card, Character } from '../cards/card';
import { PatrolZone } from 'board';
import { Phase } from './phase';

export function patrolAction(cardId: string, patrolSpot: keyof PatrolZone): void {
    let cardToPatrol = Card.idToCardMap.get(cardId);
    if (!cardToPatrol) throw new Error('Card ID ' + cardId + ' can not be found');

    if (!(cardToPatrol instanceof Character)) {
        throw new Error('Only characters can patrol');
    }

    let character = <Character>cardToPatrol;

    if (!character.canPatrol()) throw new Error('This character is unable to patrol');

    cardToPatrol.game.phaseStack.addToStack(new Phase('ChoosePatrolSlot', ['PatrolChoice']));
}

export function stopPatrollingAction(cardId: string): void {}

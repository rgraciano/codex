import { Card, Character } from '../cards/card';
import { Phase, Action } from './phase';
import { Game, EventDescriptor } from '../game';
import { CardApi } from '../cards/card_api';
import { PatrolZone } from '../board';

export function patrolAction(cardId: string): void {
    let cardToPatrol = Card.idToCardMap.get(cardId);
    if (!cardToPatrol) throw new Error('Card ID ' + cardId + ' can not be found');

    if (!(cardToPatrol instanceof Character)) {
        throw new Error('Only characters can patrol');
    }

    let character = <Character>cardToPatrol;

    if (!character.canPatrol()) throw new Error('This character is unable to patrol');

    let action = new Action('PatrolChoice').registerNeverAutoResolve();
    let phase = new Phase([action]);
    phase.extraState['patrolCardId'] = cardId;
    cardToPatrol.game.phaseStack.addToStack(phase);
}

export function sidelineAction(cardId: string): void {
    let cardToSideline = Card.idToCardMap.get(cardId);
    if (!cardToSideline) throw new Error('Card ID ' + cardId + ' can not be found');

    if (!(cardToSideline instanceof Character)) {
        throw new Error('Only characters can be sidelined');
    }

    if (!cardToSideline.canSideline()) throw new Error('Card can not be sidelined');

    CardApi.sidelineCard(cardToSideline);
    cardToSideline.game.addEvent(new EventDescriptor('Sideline', 'Sidelined ' + cardToSideline.name));
}

export function choosePatrolSlotChoice(game: Game, choiceValue: string): boolean {
    let patrolCardId = <string>game.phaseStack.topOfStack().extraState['patrolCardId'];
    if (!patrolCardId) throw new Error('Could not find patroller ID');

    let character = <Character>Card.idToCardMap.get(patrolCardId);

    if (!Reflect.ownKeys(character.controllerBoard.patrolZone).includes(choiceValue)) throw new Error('Invalid patroller slot');

    if (!character.canPatrol() || character.controllerBoard.patrolZone[choiceValue])
        throw new Error('Patroller and slot combination is not possible');

    // Move to the patroller slot
    CardApi.removeCardFromPlay(character);
    character.controllerBoard.patrolZone[choiceValue] = character;

    // Run the PatrolHook, for cards that get extra bonuses when patrolling
    CardApi.hook(game, 'patrol', [choiceValue], 'None', character);

    switch (choiceValue) {
        case 'squadLeader':
            character.attributeModifiers.armor++;
            break;
        case 'elite':
            character.attributeModifiers.attack++;
            break;
        case 'lookout':
            character.attributeModifiers.resist++;
            break;
    }

    game.addEvent(new EventDescriptor('Patrol', character.name + ' patrolled as ' + choiceValue));

    game.phaseStack.endCurrentPhase();
    return false;
}

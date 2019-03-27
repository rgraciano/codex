import { Game, EventDescriptor } from '../game';
import { StringMap } from '../game_server';
import { ActionName } from './phase';
import { Card } from '../cards/card';
import { ArrivesHandler, DiesHandler, LeavesHandler, UpkeepHandler, AttacksHandler } from '../cards/handlers';
import { CardApi } from '../cards/card_api';

import { choosePatrolSlotChoice } from './patrol_action';
import { chooseAbilityTargetChoice } from './ability_action';
import { upkeepChoice } from './start_turn_action';
import { prepareAttackTargetsChoice } from './attack_actions';
import { chooseTowerRevealChoice } from './tower_reveal_action';

export type ChoiceCategory = 'Card' | 'Building' | 'Arbitrary';
export function choiceAction(game: Game, choiceValue: string, choiceType: ChoiceCategory, action: ActionName, context: StringMap): void {
    let phase = game.phaseStack.topOfStack();

    let buildingId: string;
    //let none: boolean = false;
    let cardId: string;
    let card: Card;

    let markResolved = true;

    switch (choiceType) {
        case 'Arbitrary':
            break;

        case 'Building':
            if (['Base', 'Tech 0', 'Tech 1', 'Tech 2', 'AddOn'].find(a => a == choiceValue) === undefined)
                throw new Error('Invalid building');
            buildingId = choiceValue;
            break;

        case 'Card':
            cardId = choiceValue;
            card = Card.idToCardMap.get(cardId);
            if (!card) {
                throw new Error('Could not find card ' + cardId);
            }
            break;
    }

    switch (phase.name) {
        case 'Arrives':
            game.addEvent((<ArrivesHandler>card).onArrives(Card.idToCardMap.get(<string>phase.extraState['arrivingCardId'])));
            break;

        case 'Attack':
            game.addEvent((<AttacksHandler>card).onAttacks(Card.idToCardMap.get(<string>phase.extraState['attackingCardId'])));
            break;

        case 'ChooseAbilityTarget':
            markResolved = chooseAbilityTargetChoice(game, card, choiceValue);
            break;

        case 'ChooseTowerReveal':
            markResolved = chooseTowerRevealChoice(card);
            break;

        case 'Destroy':
            markResolved = destroyChoice(card, cardId);
            break;

        case 'DiesOrLeaves':
            markResolved = diesOrLeavesChoice(game, cardId, card);
            break;

        case 'ChoosePatrolSlot':
            markResolved = choosePatrolSlotChoice(game, choiceValue);
            break;

        case 'PrepareAttackTargets':
            markResolved = prepareAttackTargetsChoice(choiceValue, card, action, context);
            break;

        case 'Upkeep':
            markResolved = upkeepChoice(game, card);
            break;

        case 'PlayerPrompt':
            break;

        default:
            throw new Error('Could not find a phase for this choice');
    }

    if (markResolved) phase.markResolved(choiceValue);
}

function diesOrLeavesChoice(game: Game, cardId: string, card: Card): boolean {
    if (!card.game.phaseStack.topOfStack().ifToResolve(cardId)) throw new Error('Invalid choice');
    let phase = game.phaseStack.topOfStack();

    if (!phase.actionsForIds['cardId']) throw new Error('Card ' + cardId + ' is not valid for DiesOrLeaves');

    let dyingOrLeavingCard = Card.idToCardMap.get(<string>phase.extraState['dyingCardId']);

    if (phase.actionsForIds['cardId'] == 'onDies') game.addEvent((<DiesHandler>card).onDies(dyingOrLeavingCard));
    else game.addEvent((<LeavesHandler>card).onLeaves(dyingOrLeavingCard));

    return true;
}

function destroyChoice(card: Card, cardId: string): boolean {
    if (!card.game.phaseStack.topOfStack().ifToResolve(cardId)) throw new Error('Invalid choice');
    CardApi.destroyCard(card);
    return true;
}

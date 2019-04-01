import { Game, EventDescriptor } from '../game';
import { StringMap } from '../game_server';
import { ActionName } from './phase';
import { Card } from '../cards/card';
import { Hero } from '../cards/hero';
import { ArrivesHandler, DiesHandler, LeavesHandler, UpkeepHandler, AttacksHandler } from '../cards/handlers';
import { CardApi } from '../cards/card_api';

import { choosePatrolSlotChoice } from './patrol_action';
import { chooseAbilityTargetChoice } from './ability_action';
import { upkeepChoice } from './start_turn_action';
import { prepareAttackTargetsChoice } from './attack_actions';
import { chooseTowerRevealChoice } from './tower_reveal_action';

export type ChoiceCategory = 'Card' | 'Building' | 'Arbitrary';
export function choiceAction(
    game: Game,
    choiceValue: string,
    choiceType: ChoiceCategory,
    actionName: ActionName,
    context: StringMap
): void {
    let phase = game.phaseStack.topOfStack();
    let action = phase.getAction(actionName);

    if (!action) throw new Error('Invalid action');

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

    switch (actionName) {
        case 'ArrivesChoice':
            game.addEvent((<ArrivesHandler>card).onArrives(Card.idToCardMap.get(<string>phase.extraState['arrivingCardId'])));
            break;

        case 'AttacksChoice':
            game.addEvent((<AttacksHandler>card).onAttacks(Card.idToCardMap.get(<string>phase.extraState['attackingCardId'])));
            break;

        case 'AbilityChoice':
            markResolved = chooseAbilityTargetChoice(game, card, choiceValue);
            break;

        case 'TowerRevealChoice':
            markResolved = chooseTowerRevealChoice(card);
            break;

        case 'DestroyChoice':
            markResolved = destroyChoice(card);
            break;

        case 'DiesChoice':
        case 'LeavesChoice':
            markResolved = diesOrLeavesChoice(game, actionName, cardId, card);
            break;

        case 'HeroLevelChoice':
            markResolved = heroLevelChoice(card);

        case 'PatrolChoice':
            markResolved = choosePatrolSlotChoice(game, choiceValue);
            break;

        case 'PrepareAttackTargets':
            markResolved = prepareAttackTargetsChoice(choiceValue, card, actionName, context);
            break;

        case 'UpkeepChoice':
            markResolved = upkeepChoice(game, card);
            break;

        default:
            throw new Error('Could not find a phase for this choice');
    }

    if (markResolved) action.resolveId(choiceValue);
}

function diesOrLeavesChoice(game: Game, actionName: ActionName, cardId: string, card: Card): boolean {
    validateChoiceForAction(game, actionName, card.cardId);
    let phase = game.phaseStack.topOfStack();

    if (!phase.actionsForIds['cardId']) throw new Error('Card ' + cardId + ' is not valid');

    let dyingOrLeavingCard = Card.idToCardMap.get(<string>phase.extraState['dyingCardId']);

    if (actionName == 'DiesChoice') game.addEvent((<DiesHandler>card).onDies(dyingOrLeavingCard));
    else game.addEvent((<LeavesHandler>card).onLeaves(dyingOrLeavingCard));

    return true;
}

function destroyChoice(card: Card): boolean {
    validateChoiceForAction(card.game, 'DestroyChoice', card.cardId);
    CardApi.destroyCard(card);
    return true;
}

function heroLevelChoice(card: Card): boolean {
    validateChoiceForAction(card.game, 'HeroLevelChoice', card.cardId);
    let hero = <Hero>card;
    hero.level = hero.level + 2;
    return true;
}

function validateChoiceForAction(game: Game, actionName: ActionName, id: string) {
    if (
        !game.phaseStack
            .topOfStack()
            .getAction(actionName)
            .ifToResolve(id)
    )
        throw new Error('Invalid choice');
}

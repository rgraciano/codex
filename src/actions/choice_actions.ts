import { Game, EventDescriptor } from '../game';
import { StringMap } from '../game_server';
import { ActionName, Action } from './phase';
import { Card } from '../cards/card';
import { Hero } from '../cards/hero';
import { ArrivesHandler, DiesHandler, LeavesHandler, UpkeepHandler, AttacksHandler } from '../cards/handlers';
import { CardApi } from '../cards/card_api';

import { choosePatrolSlotChoice } from './patrol_action';
import { chooseAbilityTargetChoice } from './ability_action';
import { upkeepChoice } from './start_turn_action';
import { prepareAttackTargetsChoice, attackChosenTarget } from './attack_actions';
import { chooseTowerRevealChoice } from './tower_reveal_action';

export type ChoiceCategory = 'Card' | 'Building' | 'Arbitrary';
export function choiceAction(game: Game, action: Action, choiceValue: string, choiceCategory: ChoiceCategory, context: StringMap): void {
    let buildingId: string;
    //let none: boolean = false;
    let cardId: string;
    let card: Card;

    let markResolved = true;

    switch (choiceCategory) {
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

    switch (action.name) {
        case 'ArrivesChoice':
            game.addEvent((<ArrivesHandler>card).onArrives(Card.idToCardMap.get(<string>action.extraState['arrivingCardId'])));
            break;

        case 'AttacksChoice':
            game.addEvent((<AttacksHandler>card).onAttacks(Card.idToCardMap.get(<string>action.extraState['attackingCardId'])));
            break;

        case 'AbilityChoice':
            markResolved = chooseAbilityTargetChoice(game, action, card, choiceValue);
            break;

        case 'DefenderChoice':
            let attackerId = <string>action.extraState.attackingCardId;
            let attacker = Card.idToCardMap.get(attackerId);
            attackChosenTarget(attacker, buildingId, cardId);
            break;

        case 'TowerRevealChoice':
            markResolved = chooseTowerRevealChoice(card);
            break;

        case 'DestroyChoice':
            markResolved = destroyChoice(action, card);
            break;

        case 'DiesChoice':
        case 'LeavesChoice':
            markResolved = diesOrLeavesChoice(game, action, cardId, card);
            break;

        case 'HeroLevelChoice':
            markResolved = heroLevelChoice(action, card);

        case 'PatrolChoice':
            markResolved = choosePatrolSlotChoice(game, action, choiceValue);
            break;

        case 'PrepareAttackTargets':
            markResolved = prepareAttackTargetsChoice(action, choiceValue, card, context);
            break;

        case 'UpkeepChoice':
            markResolved = upkeepChoice(game, card);
            break;

        default:
            throw new Error('Could not find a phase for this choice');
    }

    if (markResolved) action.resolveId(choiceValue);
}

function diesOrLeavesChoice(game: Game, action: Action, cardId: string, card: Card): boolean {
    validateChoiceForAction(game, action, card.cardId);
    let phase = game.phaseStack.topOfStack();

    if (!phase.actionsForIds['cardId']) throw new Error('Card ' + cardId + ' is not valid');

    let dyingOrLeavingCard = Card.idToCardMap.get(<string>action.extraState['dyingCardId']);

    if (action.name == 'DiesChoice') game.addEvent((<DiesHandler>card).onDies(dyingOrLeavingCard));
    else game.addEvent((<LeavesHandler>card).onLeaves(dyingOrLeavingCard));

    return true;
}

function destroyChoice(action: Action, card: Card): boolean {
    validateChoiceForAction(card.game, action, card.cardId);
    CardApi.destroyCard(card);
    return true;
}

function heroLevelChoice(action: Action, card: Card): boolean {
    validateChoiceForAction(card.game, action, card.cardId);
    let hero = <Hero>card;
    hero.level = hero.level + 2;
    return true;
}

function validateChoiceForAction(game: Game, action: Action, id: string) {
    if (!action.ifToResolve(id)) throw new Error('Invalid choice');
}

import { Game, EventDescriptor } from '../game';
import { StringMap } from '../game_server';
import { ActionName } from './phase';
import { attackChosenTarget } from './attack_actions';
import { Card, Character } from '../cards/card';
import { ArrivesHandler, DiesHandler, LeavesHandler, UpkeepHandler, AttacksHandler } from '../cards/handlers';
import { CardApi } from '../cards/card_api';

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

function upkeepChoice(game: Game, card: Card): boolean {
    if (!game.phaseStack.topOfStack().ifToResolve(card.cardId)) throw new Error('Invalid choice');
    game.addEvent((<UpkeepHandler>card).onUpkeep());
    return true;
}

function prepareAttackTargetsChoice(choiceValue: string, card: Card, action: string, context: StringMap): boolean {
    if (!card.game.phaseStack.topOfStack().ifToResolve(choiceValue)) throw new Error('Invalid choice');

    if (action == 'AttackCardsOrBuildingsChoice') {
        context.building ? attackChosenTarget(card, context.building) : attackChosenTarget(card, undefined, context.validCardTargetId);
    } else {
        attackChosenTarget(card, undefined, context.validCardTargetId);
    }
    return true;
}

function choosePatrolSlotChoice(game: Game, choiceValue: string): boolean {
    let patrolCardId = <string>game.phaseStack.topOfStack().extraState['patrolCardId'];
    if (!patrolCardId) throw new Error('Could not find patroller ID');

    let character = <Character>Card.idToCardMap.get(patrolCardId);

    if (!Reflect.ownKeys(character.controllerBoard.patrolZone).includes(choiceValue)) throw new Error('Invalid patroller slot');

    if (!character.canPatrol() || character.controllerBoard.patrolZone[choiceValue])
        throw new Error('Patroller and slot combination is not possible');

    CardApi.removeCardFromPlay(character);
    character.controllerBoard.patrolZone[choiceValue] = character;
    game.addEvent(new EventDescriptor('Patrol', character.name + ' patrolled as ' + choiceValue));

    game.phaseStack.endCurrentPhase();

    return false;
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

function chooseTowerRevealChoice(card: Card) {
    if (!card.game.phaseStack.topOfStack().ifToResolve(card.cardId)) throw new Error('Invalid choice');
    card.gainProperty('towerRevealedThisTurn');
    card.game.addEvent(new EventDescriptor('TowerReveal', 'Tower revealed ' + card.name));
    return true;
}

function chooseAbilityTargetChoice(game: Game, card: Card, cardId: string) {
    let phase = game.phaseStack.topOfStack();
    let cardWithAbility = Card.idToCardMap.get(<string>phase.extraState['cardWithAbility']);
    let ability = cardWithAbility.abilityMap.get(<string>phase.extraState['abilityName']);

    if (!card.game.phaseStack.topOfStack().ifToResolve(cardId)) throw new Error('Invalid choice');

    /*if (none) {
        // if the user chose 'none', end phase and do not resolve
        game.addEvent(new EventDescriptor('NoneChosen', 'Player chose not to target anything'));
        game.phaseStack.endCurrentPhase();
        return false;
    }*/

    let chooseNumber = <number>phase.extraState['chooseNumber'];
    let haveChosen = <number>phase.extraState['haveChosen'];

    haveChosen++; // count this choice
    phase.extraState['haveChosen'] = haveChosen;

    if (haveChosen == chooseNumber)
        // if we've chosen the max number of things we can choose, end the phase
        game.phaseStack.endCurrentPhase();

    let destroyed = false;
    if (card && <boolean>phase.extraState['usesTargetingRules']) {
        // subtract any resistance on the targeted card
        let eff = card.effective();
        cardWithAbility.controllerBoard.gold -= eff.resist;

        // some things die when targeted, eg illusions
        if (eff.diesWhenTargeted > 0) {
            CardApi.destroyCard(card);
            destroyed = true;
        }
    }

    // if we killed the thing we targeted, then the event no longer occurs. otherwise, resolve
    if (!destroyed) game.addEvent(ability.resolveChoice(cardId));

    return true;
}

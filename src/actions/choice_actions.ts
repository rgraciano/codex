import { Game, EventDescriptor } from '../game';
import { StringMap } from '../game_server';
import { ActionName } from './phase';
import { attackChosenTarget } from './attack_actions';
import { Card } from '../cards/card';
import { ArrivesHandler, DiesHandler, LeavesHandler, UpkeepHandler, AttacksHandler } from '../cards/handlers';
import { CardApi } from '../cards/card_api';

export function choiceAction(game: Game, cardOrBuildingId: string, action: ActionName, context: StringMap): void {
    let phase = game.phaseStack.topOfStack();

    if (!phase.ifToResolve(cardOrBuildingId)) throw new Error('Invalid choice');

    let buildingId: string;
    let none: boolean = false;
    let cardId: string;
    let card: Card;

    if (['Base', 'Tech 0', 'Tech 1', 'Tech 2', 'AddOn'].find(a => a == cardOrBuildingId) !== undefined) buildingId = cardOrBuildingId;
    else if (cardOrBuildingId == 'None') none = true;
    else cardId = cardOrBuildingId;

    if (cardId !== undefined) {
        card = Card.idToCardMap.get(cardId);

        if (!card) {
            throw new Error('Could not find card ' + cardId);
        }
    }

    switch (phase.name) {
        case 'Arrives':
            game.addEvent((<ArrivesHandler>card).onArrives(Card.idToCardMap.get(<string>phase.extraState['arrivingCardId'])));
            break;

        case 'Attack':
            game.addEvent((<AttacksHandler>card).onAttacks(Card.idToCardMap.get(<string>phase.extraState['attackingCardId'])));
            break;

        case 'ChooseAbilityTarget':
            let cardWithAbility = Card.idToCardMap.get(<string>phase.extraState['cardWithAbility']);
            let ability = cardWithAbility.abilityMap.get(<string>phase.extraState['abilityName']);

            if (none) {
                // if the user chose 'none', end phase and do not resolve
                game.addEvent(new EventDescriptor('NoneChosen', 'Player chose not to target anything'));
                game.phaseStack.endCurrentPhase();
                break;
            }

            let chooseNumber = <number>phase.extraState['chooseNumber'];
            let haveChosen = <number>phase.extraState['haveChosen'];

            haveChosen++; // count this choice
            phase.extraState['haveChosen'] = haveChosen;

            if (haveChosen == chooseNumber)
                // if we've chosen the max number of things we can choose, end the phase
                game.phaseStack.endCurrentPhase();

            if (card && <boolean>phase.extraState['usesTargetingRules']) {
                // subtract any resistance on the targeted card
                cardWithAbility.controllerBoard.gold -= card.effective().resist;
            }

            game.addEvent(ability.resolveChoice(cardOrBuildingId));
            break;

        case 'Destroy':
            CardApi.destroyCard(Card.idToCardMap.get(cardId));
            break;

        case 'DiesOrLeaves':
            if (!phase.actionsForIds['cardId']) throw new Error('Card ' + cardId + ' is not valid for DiesOrLeaves');

            let dyingOrLeavingCard = Card.idToCardMap.get(<string>phase.extraState['dyingCardId']);

            if (phase.actionsForIds['cardId'] == 'onDies') game.addEvent((<DiesHandler>card).onDies(dyingOrLeavingCard));
            else game.addEvent((<LeavesHandler>card).onLeaves(dyingOrLeavingCard));
            break;

        case 'PrepareAttackTargets':
            if (action == 'AttackCardsOrBuildingsChoice') {
                context.building
                    ? attackChosenTarget(card, context.building)
                    : attackChosenTarget(card, undefined, context.validCardTargetId);
            } else {
                attackChosenTarget(card, undefined, context.validCardTargetId);
            }
            break;

        case 'Upkeep':
            game.addEvent((<UpkeepHandler>card).onUpkeep());
            break;

        case 'PlayerPrompt':
        default:
            throw new Error('Could not find a phase for this choice');
    }

    phase.markResolved(cardOrBuildingId);
}

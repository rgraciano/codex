import { Game } from '../game';
import { StringMap } from '../game_server';
import { ActionName } from '../actions/phase';
import { attackChosenTarget } from '../actions/attack';
import { Card } from '../cards/card';
import { ArrivesHandler, DiesHandler, LeavesHandler, UpkeepHandler, AttacksHandler } from '../cards/handlers';
import { CardApi } from '../cards/card_api';
import { stringify } from 'querystring';

export function choiceAction(game: Game, cardId: string, action: ActionName, context: StringMap): void {
    let phase = game.phaseStack.topOfStack();

    let card: Card = Card.idToCardMap.get(cardId);

    if (!card) {
        throw new Error('Could not find card ' + cardId);
    }

    if (!phase.ifToResolve(cardId)) throw new Error('No resolve map in this phase');

    switch (phase.name) {
        case 'Arrives':
            game.addEvent((<ArrivesHandler>card).onArrives(Card.idToCardMap.get(<string>phase.extraState['arrivingCardId'])));
            break;
        case 'DiesOrLeaves':
            if (!phase.actionsForIds['cardId']) throw new Error('Card ' + cardId + ' is not valid for DiesOrLeaves');

            let dyingOrLeavingCard = Card.idToCardMap.get(<string>phase.extraState['dyingCardId']);

            if (phase.actionsForIds['cardId'] == 'onDies') game.addEvent((<DiesHandler>card).onDies(dyingOrLeavingCard));
            else game.addEvent((<LeavesHandler>card).onLeaves(dyingOrLeavingCard));
            break;
        case 'Upkeep':
            game.addEvent((<UpkeepHandler>card).onUpkeep());
            break;
        case 'Destroy':
            CardApi.destroyCard(Card.idToCardMap.get(cardId));
            break;
        case 'Attack':
            game.addEvent((<AttacksHandler>card).onAttacks(Card.idToCardMap.get(<string>phase.extraState['attackingCardId'])));
            break;
        case 'PrepareAttackTargets':
            if (action == 'AttackCardsOrBuildingsChoice') {
                context.building
                    ? attackChosenTarget(card, context.building)
                    : attackChosenTarget(card, undefined, context.validCardTargetId);
            } else {
                attackChosenTarget(card, undefined, context.validCardTargetId);
            }
        case 'PlayerPrompt':
        default:
            throw new Error('Could not find a phase for this choice');
    }

    phase.markResolved(cardId);
}

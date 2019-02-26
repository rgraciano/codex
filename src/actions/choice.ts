
import { Game } from '../game';
import { StringMap } from '../game_server';
import { ActionName } from '../actions/phase';
import { attackChosenTarget } from '../actions/attack';
import { Card, ArrivesHandler, DiesHandler, LeavesHandler, UpkeepHandler, AttacksHandler } from '../cards/card';
import { CardApi } from '../cards/card_api';

export function choiceAction(game: Game, cardId: string, action: ActionName, context: StringMap): void {
    let phase = game.phaseStack.topOfStack();

    let card: Card = Card.idToCardMap.get(cardId);

    if (!card) {
        throw new Error('Could not find card ' + cardId);
    }

    let mustResolveMap = phase.getMustResolveMapForCardId(cardId);

    if (!mustResolveMap)
        throw new Error('No resolve map in this phase');

    switch (phase.name) {
        case 'Arrives':
            game.addEvent((<ArrivesHandler>card).onArrives(Card.idToCardMap.get(<string>mustResolveMap['arrivingCardId'])));
            break;
        case 'DiesOrLeaves':
            if (mustResolveMap['dyingCardId'])
                game.addEvent((<DiesHandler>card).onDies(Card.idToCardMap.get(<string>mustResolveMap['dyingCardId'])));
            else if (mustResolveMap['leavingCardId'])
                game.addEvent((<LeavesHandler>card).onLeaves(Card.idToCardMap.get(<string>mustResolveMap['leavingCardId'])));
            else
                throw new Error('Could not find corresponding ID for DiesOrLeaves');
            break;
        case 'Upkeep':
            game.addEvent((<UpkeepHandler>card).onUpkeep());
            break;
        case 'Destroy':
            CardApi.destroyCard(Card.idToCardMap.get(<string>mustResolveMap['resolveId']));
            break;
        case 'Attack':
            game.addEvent((<AttacksHandler>card).onAttacks(Card.idToCardMap.get(<string>mustResolveMap['attackingCardId'])));
            break;
        case 'PrepareAttackTargets':
            if (action == 'AttackCardsOrBuildingsChoice') {
                context.building ? attackChosenTarget(card, context.building) : attackChosenTarget(card, undefined, context.validCardTargetId);
            }
            else {
                attackChosenTarget(card, undefined, context.validCardTargetId);
            }
        case 'PlayerPrompt':
        default:
            throw new Error('Could not find a phase for this choice');

    }

    phase.markResolved(cardId);
}
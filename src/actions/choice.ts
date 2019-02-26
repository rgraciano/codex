
import { Game } from '../game';
import { Card, ArrivesHandler, DiesHandler, LeavesHandler, UpkeepHandler } from '../cards/card';

export function choiceAction(game: Game, cardId: string): void {
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
            game.addEvent((<ArrivesHandler>card).onArrives(Card.idToCardMap.get(mustResolveMap['arrivingCardId'])));
            break;
        case 'DiesOrLeaves':
            if (mustResolveMap['dyingCardId'])
                game.addEvent((<DiesHandler>card).onDies(Card.idToCardMap.get(mustResolveMap['dyingCardId'])));
            else if (mustResolveMap['leavingCardId'])
                game.addEvent((<LeavesHandler>card).onLeaves(Card.idToCardMap.get(mustResolveMap['leavingCardId'])));
            else
                throw new Error('Could not find corresponding ID for DiesOrLeaves');
            break;
        case 'Upkeep':
            game.addEvent((<UpkeepHandler>card).onUpkeep());
            break;
        case 'PlayerPrompt':
        default:
            throw new Error('Could not find a phase for this choice');

    }

    phase.markResolved(cardId);
}
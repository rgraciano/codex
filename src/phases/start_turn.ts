
import { Game, EventDescriptor } from '../game';
import { Card } from '../cards/card';
import { Board} from '../board';
import { PatrolZone } from '../board';
import { Phase } from './phase';
import { UpkeepHandler } from '../cards/card';

export function startTurnAction(game: Game): void {
    let boards = game.getBoardAndOpponentBoard();
    let board = boards[0];
    let opponentBoard = boards[1];

    board.turnCount++; // TODO: This needs to be done per player
    
    // clear patrol zone, moving everything to "in play"
    game.addEvent(clearPatrolZone(board));

    // ready everything
    game.addEvents(readyAllCards(game, board));

    // TODO: tick off hero availability when heroes are implemented

    // collect gold
    game.addEvent(board.collectGold());

    // add your turn to the phase stack
    game.phaseStack.addToStack(new Phase('PlayerTurn', [ 'PlayCard', 'Worker', 'Tech', 'BuildTech', 'BuildAddOn', 'Patrol', 'Ability', 'Attack', 'HeroSummon', 'HeroLevel', 'EndTurn']));

    // enter upkeep phase, process upkeep events
    enterUpkeepPhase(game);
}

/**
 * Enters the upkeep phase and processes 
 */
function enterUpkeepPhase(game: Game): void {
    let board = game.getBoardAndOpponentBoard()[0];

    let phase: Phase;

    // check the phase. is this the upkeep phase? if not, create the upkeep phase and put it on top of the stack
    if (game.phaseStack.topOfStack().name != 'Upkeep') {
        phase = new Phase('Upkeep', [ 'UpkeepChoice' ]);
        game.phaseStack.addToStack(phase);
    }
    else {
        phase = game.phaseStack.topOfStack();
    }

    // find all of the cards with handlers that match
    let foundCards: Array<Card> = Game.findCardsWithHandlers(board.inPlay, 'onUpkeep');
    
    // add all of those cards to the list of allowedActions, automatically removing those that were already resolved and ensuring there are no duplicates
    phase.filterResolvedAndMarkMustDo(foundCards);
}

export function upkeepChoiceAction(game: Game, cardId: string): void {

    let phase = game.phaseStack.topOfStack();

    if (phase.name != 'Upkeep' || !phase.mustResolve(cardId)) {
        game.addEvent(new EventDescriptor('Error', 'Upkeep is not valid for ID ' + cardId));
        return;
    }

    // We are about to fire this handler, so we'll mark its ID done
    phase.markResolved(cardId);

    // Do the upkeep thing
    let upkpHandler: UpkeepHandler = <UpkeepHandler>Card.idToCardMap.get(cardId);
    game.addEvent(upkpHandler.onUpkeep());
}

function clearPatrolZone(board: Board) {
    let patrolSlot: keyof PatrolZone;

    for (patrolSlot in board.patrolZone) {
        let patroller: Card = board.patrolZone[patrolSlot];

        if (patroller) {
            board.inPlay.push(patroller);
            board.patrolZone[patrolSlot] = null;
        }
    }

    return new EventDescriptor('ClearPatrolZone', 'Cleared the patrol zone');
}

function readyAllCards(game: Game, board: Board): Array<EventDescriptor> {
    // Nothing happens when we ready cards, so we don't have to worry about any triggers happening here.

    let andDoToReadyCards = function(card: Card): EventDescriptor {
        if (card.attributeModifiers.exhausted > 0)
            card.attributeModifiers.exhausted--; // decrement because adding to this means it's disabled or may have come into play exhausted
        
        card.attributeModifiers.arrivalFatigue = 0; // set to zero because you have arrival fatigue or you don't
        return new EventDescriptor('ReadyCard', 'Readied ' + card.name, card.cardId);
    };
    let matching = function(card: Card): boolean {
        let attrs = card.effective();
        return (attrs.exhausted > 0 || attrs.arrivalFatigue > 0);
    };
    
    return Game.findAndDoOnCards(board.inPlay, matching, andDoToReadyCards);
}
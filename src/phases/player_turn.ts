
import { Game, EventDescriptor } from '../game';
import { Card } from '../cards/card';
import { Board} from '../board';
import { PatrolZone } from '../board';
import { Phase } from './phase';

export function startTurn(game: Game): void {
    let boards = game.getBoardAndOpponentBoard();
    let board = boards[0];
    let opponentBoard = boards[1];

    board.turnCount++;
    
    // clear patrol zone, moving everything to "in play"
    game.addEvent(clearPatrolZone(board));

    // READY PHASE
    game.addEvents(readyAllCards(game, board));

    // TODO: tick off hero availability when heroes are implemented

    // upkeep (aka trigger central)
    game.addEvent(board.collectGold());
    // TODO: This should return an ED to talk to the user...
    // TODO: account for slow-time generator

        // build fading/forecast events; build onupkeep events; all mix together into one trigger list          
}

export function upkeep(game: Game, card?: Card): void {
    let boards = game.getBoardAndOpponentBoard();
    let board = boards[0];
    let opponentBoard = boards[1];

    if (card) {
        // if the user wanted to process a particular card to upkeep, do this stuff
    }

    let phase: Phase;

    // check the phase. is this the upkeep phase? if not, create the upkeep phase and put it on top of the stack.
    if (game.phaseStack.topOfStack().phase != 'Upkeep') {
        phase = new Phase('Upkeep', [ 'Upkeep' ]);
        game.phaseStack.addToStack(phase);
    }
    else {
        phase = game.phaseStack.topOfStack();
    }

    // find all of the cards with handlers that match
    let foundCards: Array<Card> = Game.findCardsWithHandlers(board.inPlay, 'onUpkeep');
    
    // add all of those cards to the list of allowedActions, automatically removing those that were already resolved
    phase.filterResolvedAndMarkMustDo(foundCards);

    // if the list is now empty, pop the upkeep phase off the stack
    if (phase.mustResolveTriggersOn.length == 0) {
        game.phaseStack.endCurrentPhase();
        game.addEvent(new EventDescriptor('UpkeepOver', 'Upkeep phase completed'));
    }
    else {
        // return list of upkeep choices to the client
        game.addEvents(phase.mustResolveTriggersOn.map(cardId => {
            return new EventDescriptor('UpkeepChoices', 'Upkeep still to be processed', cardId);
        }));
    }
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
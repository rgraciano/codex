
import { Game } from '../game';
import { Card } from '../cards/card';
import { PatrolZone } from '../board';
import { Trigger, EventDescriptor } from '../trigger';


export function startTurn(game: Game, playerNumber: number): void {
    let board, opponentBoard;

    if (playerNumber == 1) {
        board = game.player1Board;
        opponentBoard = game.player2Board;
    }
    else {
        board = game.player2Board;
        opponentBoard = game.player1Board;
    }

    board.turnCount++;
    
    // clear patrol zone, moving everything to "in play"
    let patrolSlot: keyof PatrolZone;
    for (patrolSlot in board.patrolZone) {
        if (patrolSlot !== null) {
            board.inPlay.push(board.patrolZone[patrolSlot]);
            board.patrolZone[patrolSlot] = null;
        }
    }

    // READY PHASE
    // Nothing happens when we ready cards, so we don't have to worry about any triggers happening here.
    let andDoToReadyCards = function(card: Card): Trigger {
        if (card.attributeModifiers.exhausted > 0)
            card.attributeModifiers.exhausted--; // decrement because adding to this means it's disabled or may have come into play exhausted
        
        card.attributeModifiers.arrivalFatigue = 0; // set to zero because you have arrival fatigue or you don't
        return new Trigger(new EventDescriptor('ReadyCard', 'Readied ' + card.name, card));
    };
    let matching = function(card: Card): boolean {
        let attrs = card.effective();
        return (attrs.exhausted > 0 || attrs.arrivalFatigue > 0);
    };
    game.findAndDoOnCards(board.inPlay, matching, andDoToReadyCards);


    // TODO: tick off hero availability when heroes are implemented


    // upkeep (aka trigger central)
        // get gold, TODO: account for slow-time generator

        // build fading/forecast events; build onupkeep events; all mix together into one trigger list          
}
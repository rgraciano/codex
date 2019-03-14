import { Game } from '../game';
import { BoardBuilding } from 'board';

export function buildAction(game: Game, buildingId: string, addOnExtra: string = undefined): void {
    let building: BoardBuilding;
    let board = game.activePlayer == 1 ? game.player1Board : game.player2Board;

    switch (buildingId) {
        case 'Tech 1':
            building = board.tech1;
            break;
        case 'Tech 2':
            building = board.tech2;
            break;
        case 'Tech 3':
            building = board.tech3;
            break;
        case 'AddOn':
            building = board.addOn;
            break;
        default:
            throw new Error('Building ID ' + buildingId + ' not recognized');
    }

    if (!addOnExtra) {
        if (building.canBuild(buildingId, board.gold, board.workerCount(), board.multiColor)
    }
}

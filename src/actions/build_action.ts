import { Game, EventDescriptor } from '../game';
import { BoardBuilding, AddOnType } from 'board';

export function buildAction(game: Game, buildingId: string, addOnExtra: AddOnType = undefined): void {
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

    let idToBuild = addOnExtra ? addOnExtra : buildingId;

    if (!building.canBuild(idToBuild)) throw new Error('Do not meet requirements for ' + buildingId);

    if (buildingId == 'AddOn') building.build(false, addOnExtra);
    else building.build();

    game.addEvent(new EventDescriptor('Built', 'Built ' + buildingId));
}

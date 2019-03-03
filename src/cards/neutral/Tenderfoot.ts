
import { FlavorType, TechLevel, Attributes, Unit } from '../card';
import { Game, EventDescriptor } from '../../game';
import * as Color from '../color';

export class Tenderfoot extends Unit {
    protected baseAttributes = new Attributes();

    color: Color.ColorName = 'Neutral';
    spec: Color.Spec = 'Starter';
    flavorType: FlavorType = "Virtuoso";
    name: string = "Tenderfoot";
    techLevel: TechLevel = "Tech 0";
    importPath: string = "./neutral";

    constructor(game: Game, owner: number, controller?: number, cardId?: string) {
        super(game, owner, controller, cardId);
        this.baseAttributes.health = 2;
        this.baseAttributes.attack = 1;
        this.baseAttributes.cost = 1;
    }
}
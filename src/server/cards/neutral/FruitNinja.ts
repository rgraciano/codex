
import { Color, FlavorType, TechLevel, Attributes, Unit } from '../card';
import { Game, EventDescriptor } from '../../game';

export class FruitNinja extends Unit {
    protected baseAttributes = new Attributes();

    color: Color = "Neutral";
    flavorType: FlavorType = "Ninja";
    name: string = "Fruit Ninja";
    techLevel: TechLevel = "Tech 0";
    importPath: string = "./neutral";

    constructor(game: Game, owner: number, controller?: number, cardId?: string) {
        super(game, owner, controller, cardId);
        this.baseAttributes.health = 2;
        this.baseAttributes.attack = 2;
        this.baseAttributes.cost = 3;
        this.baseAttributes.frenzy = 1;
    }
}
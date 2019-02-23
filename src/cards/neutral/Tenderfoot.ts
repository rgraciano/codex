
import { Color, FlavorType, TechLevel, Attributes, Unit } from '../card';

export class Tenderfoot extends Unit {
    protected baseAttributes = new Attributes();

    color: Color = "Neutral";
    flavorType: FlavorType = "Virtuoso";
    name: string = "Tenderfoot";
    techLevel: TechLevel = "Tech 0";
    importPath: string = "./neutral";

    constructor(owner: number, controller?: number) {
        super(owner, controller);
        this.baseAttributes.health = 2;
        this.baseAttributes.attack = 1;
        this.baseAttributes.cost = 1;
    }
}
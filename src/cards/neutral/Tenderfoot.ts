
import { Color, FlavorType, TechLevel, Attributes, Unit } from '../cards';

export class Tenderfoot extends Unit {
    protected baseAttributes = new Attributes();

    color: Color = "Neutral";
    flavorType: FlavorType = "Virtuoso";
    name: string = "Tenderfoot";
    techLevel: TechLevel = "Tech 0";

    constructor() {
        super();
        this.baseAttributes.health = 2;
        this.baseAttributes.attack = 1;
        this.baseAttributes.cost = 1;
    }
}
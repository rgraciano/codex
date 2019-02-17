
import { Color, FlavorType, TechLevel, Attributes, Unit } from '../card';

export class OlderBrother extends Unit {
    protected baseAttributes = new Attributes();

    color: Color = "Neutral";
    flavorType: FlavorType = "Drunkard";
    name: string = "Older Brother";
    techLevel: TechLevel = "Tech 0";

    constructor() {
        super();
        this.baseAttributes.health = 2;
        this.baseAttributes.attack = 2;
        this.baseAttributes.cost = 2;
    }
}
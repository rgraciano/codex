
import { Color, FlavorType, TechLevel, Attributes, Unit } from '../cards';

export class FruitNinja extends Unit {
    protected baseAttributes = new Attributes();

    color: Color = "Neutral";
    flavorType: FlavorType = "Ninja";
    name: string = "Fruit Ninja";
    techLevel: TechLevel = "Tech 0";

    constructor() {
        super();
        this.baseAttributes.health = 2;
        this.baseAttributes.attack = 2;
        this.baseAttributes.frenzy = 1;
    }
}
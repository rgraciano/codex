
import { Color, FlavorType, TechLevel, Attributes, Unit } from 'cards/cards';

export class FruitNinja extends Unit {
    protected baseAttributes = new Attributes();

    public color: Color = "Neutral";
    public flavorType: FlavorType = "Ninja";
    public name: string = "Fruit Ninja";
    public techLevel: TechLevel = "Tech 0";

    constructor() {
        super();
        this.baseAttributes.health = 2;
        this.baseAttributes.attack = 2;
        this.baseAttributes.frenzy = 1;
    }
}
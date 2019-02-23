
import { Color, FlavorType, TechLevel, Attributes, Unit } from '../card';

export class FruitNinja extends Unit {
    protected baseAttributes = new Attributes();

    color: Color = "Neutral";
    flavorType: FlavorType = "Ninja";
    name: string = "Fruit Ninja";
    techLevel: TechLevel = "Tech 0";
    importPath: string = "./neutral";

    constructor(owner: number, controller?: number) {
        super(owner, controller);
        this.baseAttributes.health = 2;
        this.baseAttributes.attack = 2;
        this.baseAttributes.frenzy = 1;
    }
}
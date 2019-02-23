
import { Color, FlavorType, TechLevel, Attributes, Unit } from '../card';

export class TimelyMessenger extends Unit {
    protected baseAttributes = new Attributes();

    color: Color = "Neutral";
    flavorType: FlavorType = "Mercenary";
    name: string = "Timely Messenger";
    techLevel: TechLevel = "Tech 0";
    importPath: string = "./neutral";

    constructor(owner: number, controller?: number) {
        super(owner, controller);
        this.baseAttributes.health = 1;
        this.baseAttributes.attack = 1;
        this.baseAttributes.cost = 1;
        this.baseAttributes.haste = 1;
    }
}

import { Color, FlavorType, TechLevel, Attributes, Unit } from '../cards';

export class TimelyMessenger extends Unit {
    protected baseAttributes = new Attributes();

    color: Color = "Neutral";
    flavorType: FlavorType = "Mercenary";
    name: string = "Timely Messenger";
    techLevel: TechLevel = "Tech 0";

    constructor() {
        super();
        this.baseAttributes.health = 1;
        this.baseAttributes.attack = 1;
        this.baseAttributes.cost = 1;
        this.baseAttributes.haste = 1;
    }
}
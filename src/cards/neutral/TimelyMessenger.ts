
import { Color, FlavorType, TechLevel, Attributes, Unit } from '../cards';

export class TimelyMessenger extends Unit {
    protected baseAttributes = new Attributes();

    public color: Color = "Neutral";
    public flavorType: FlavorType = "Mercenary";
    public name: string = "Timely Messenger";
    public techLevel: TechLevel = "Tech 0";

    constructor() {
        super();
        this.baseAttributes.health = 1;
        this.baseAttributes.attack = 1;
        this.baseAttributes.cost = 1;
        this.baseAttributes.haste = 1;
    }
}
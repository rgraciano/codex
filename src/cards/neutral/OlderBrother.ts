
import { Color, FlavorType, TechLevel, Attributes, Unit } from '../cards';

export class OlderBrother extends Unit {
    protected baseAttributes = new Attributes();

    public color: Color = "Neutral";
    public flavorType: FlavorType = "Drunkard";
    public name: string = "Older Brother";
    public techLevel: TechLevel = "Tech 0";

    constructor() {
        super();
        this.baseAttributes.health = 2;
        this.baseAttributes.attack = 2;
        this.baseAttributes.cost = 2;
    }
}
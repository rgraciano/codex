import { TechLevel, Attributes, Unit } from '../../card';
import * as Color from '../../color';

export class HelpfulTurtle extends Unit {
    protected baseAttributes = new Attributes();

    color: Color.ColorName = 'Neutral';
    spec: Color.Spec = 'Starter';
    flavorType = 'Cute Animal';
    name: string = 'Helpful Turtle';
    techLevel: TechLevel = 0;
    importPath: string = './neutral/starter';

    constructor(owner: number, controller?: number, cardId?: string) {
        super(owner, controller, cardId);

        this.baseAttributes.cost = 2;

        this.baseAttributes.attack = 1;
        this.baseAttributes.health = 2;

        this.baseAttributes.healing = 1;
    }
}

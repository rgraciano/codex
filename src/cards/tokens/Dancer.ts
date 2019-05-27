import { TechLevel, Attributes, Unit } from '../card';
import * as Color from '../color';

export class Dancer extends Unit {
    protected baseAttributes = new Attributes();

    color: Color.ColorName = 'Neutral';
    spec: Color.Spec = 'Starter';
    flavorType = 'Dancer';
    name: string = 'Dancer';
    techLevel: TechLevel = 0;
    importPath: string = './neutral/starter';

    constructor(owner: number, controller?: number, cardId?: string) {
        super(owner, controller, cardId);

        this.baseAttributes.cost = 0;

        this.baseAttributes.attack = 0;
        this.baseAttributes.health = 1;
    }

    makeAngry() {
        this.name = 'Angry Dancer';
        this.attributeModifiers.attack = 2;
        this.attributeModifiers.health = 3;
        this.attributeModifiers.unstoppable = 1;
    }
}

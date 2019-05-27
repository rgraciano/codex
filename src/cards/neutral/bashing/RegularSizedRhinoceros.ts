import { TechLevel, Attributes, Unit } from '../../card';
import * as Color from '../../color';

export class RegularSizedRhinoceros extends Unit {
    protected baseAttributes = new Attributes();

    color: Color.ColorName = 'Neutral';
    spec: Color.Spec = 'Bashing';
    flavorType = 'Rhino';
    name: string = 'Regular-sized Rhinoceros';
    techLevel: TechLevel = 2;
    importPath: string = './neutral/bashing';

    constructor(owner: number, controller?: number, cardId?: string) {
        super(owner, controller, cardId);

        this.baseAttributes.cost = 4;

        this.baseAttributes.attack = 5;
        this.baseAttributes.health = 6;
    }
}

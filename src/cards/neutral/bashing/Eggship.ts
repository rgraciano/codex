import { TechLevel, Attributes, Unit } from '../../card';
import * as Color from '../../color';

export class Eggship extends Unit {
    protected baseAttributes = new Attributes();

    color: Color.ColorName = 'Neutral';
    spec: Color.Spec = 'Bashing';
    flavorType = 'Contraption';
    name: string = 'Eggship';
    techLevel: TechLevel = 2;
    importPath: string = './neutral/bashing';

    constructor(owner: number, controller?: number, cardId?: string) {
        super(owner, controller, cardId);

        this.baseAttributes.cost = 4;

        this.baseAttributes.attack = 4;
        this.baseAttributes.health = 3;

        this.baseAttributes.flying = 1;
    }
}

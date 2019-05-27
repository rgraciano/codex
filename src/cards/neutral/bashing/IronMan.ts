import { TechLevel, Attributes, Unit } from '../../card';
import * as Color from '../../color';

export class IronMan extends Unit {
    protected baseAttributes = new Attributes();

    color: Color.ColorName = 'Neutral';
    spec: Color.Spec = 'Bashing';
    flavorType = 'Mercenary';
    name: string = 'Iron Man';
    techLevel: TechLevel = 1;
    importPath: string = './neutral/bashing';

    constructor(owner: number, controller?: number, cardId?: string) {
        super(owner, controller, cardId);

        this.baseAttributes.cost = 3;

        this.baseAttributes.attack = 3;
        this.baseAttributes.health = 4;
    }
}

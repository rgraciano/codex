import { TechLevel, Attributes, Unit } from '../../card';
import * as Color from '../../color';

export class Tenderfoot extends Unit {
    protected baseAttributes = new Attributes();

    color: Color.ColorName = 'Neutral';
    spec: Color.Spec = 'Starter';
    flavorType = 'Virtuoso';
    name: string = 'Tenderfoot';
    techLevel: TechLevel = 0;
    importPath: string = './neutral/starter';

    constructor(owner: number, controller?: number, cardId?: string) {
        super(owner, controller, cardId);

        this.baseAttributes.cost = 1;

        this.baseAttributes.attack = 2;
        this.baseAttributes.health = 1;
    }
}

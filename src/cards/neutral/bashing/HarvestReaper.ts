import { TechLevel, Attributes, Unit } from '../../card';
import * as Color from '../../color';

export class HarvestReaper extends Unit {
    protected baseAttributes = new Attributes();

    color: Color.ColorName = 'Neutral';
    spec: Color.Spec = 'Bashing';
    flavorType = 'Contraption';
    name: string = 'Harvest Reaper';
    techLevel: TechLevel = 2;
    importPath: string = './neutral/bashing';

    constructor(owner: number, controller?: number, cardId?: string) {
        super(owner, controller, cardId);

        this.baseAttributes.cost = 5;

        this.baseAttributes.attack = 6;
        this.baseAttributes.health = 5;

        this.baseAttributes.overpower = 1;
    }
}

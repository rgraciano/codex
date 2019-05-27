import { TechLevel, Attributes, Unit } from '../../card';
import * as Color from '../../color';

export class LeapingLizard extends Unit {
    protected baseAttributes = new Attributes();

    color: Color.ColorName = 'Neutral';
    spec: Color.Spec = 'Finesse';
    flavorType = 'Lizardman';
    name: string = 'Leaping Lizard';
    techLevel: TechLevel = 2;
    importPath: string = './neutral/finesse';

    constructor(owner: number, controller?: number, cardId?: string) {
        super(owner, controller, cardId);

        this.baseAttributes.cost = 1;

        this.baseAttributes.attack = 3;
        this.baseAttributes.health = 5;

        this.baseAttributes.antiAir = 1;
    }
}

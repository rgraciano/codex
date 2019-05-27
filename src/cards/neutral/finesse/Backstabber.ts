import { TechLevel, Attributes, Unit } from '../../card';
import * as Color from '../../color';

export class Backstabber extends Unit {
    protected baseAttributes = new Attributes();

    color: Color.ColorName = 'Neutral';
    spec: Color.Spec = 'Finesse';
    flavorType = 'Rogue';
    name: string = 'Backstabber';
    techLevel: TechLevel = 2;
    importPath: string = './neutral/finesse';

    constructor(owner: number, controller?: number, cardId?: string) {
        super(owner, controller, cardId);

        this.baseAttributes.cost = 3;

        this.baseAttributes.attack = 3;
        this.baseAttributes.health = 3;

        this.baseAttributes.invisible = 1;
    }
}

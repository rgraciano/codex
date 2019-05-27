import { TechLevel, Attributes, Unit } from '../../card';
import * as Color from '../../color';

export class RevolverOcelot extends Unit {
    protected baseAttributes = new Attributes();

    color: Color.ColorName = 'Neutral';
    spec: Color.Spec = 'Bashing';
    flavorType = 'Leopard';
    name: string = 'Revolver Ocelot';
    techLevel: TechLevel = 1;
    importPath: string = './neutral/bashing';

    constructor(owner: number, controller?: number, cardId?: string) {
        super(owner, controller, cardId);

        this.baseAttributes.cost = 2;

        this.baseAttributes.attack = 3;
        this.baseAttributes.health = 3;

        this.baseAttributes.sparkshot = 1;
    }
}

import { TechLevel, Attributes, Unit } from '../../card';
import * as Color from '../../color';

export class OlderBrother extends Unit {
    protected baseAttributes = new Attributes();

    color: Color.ColorName = 'Neutral';
    spec: Color.Spec = 'Starter';
    flavorType = 'Drunkard';
    name: string = 'Older Brother';
    techLevel: TechLevel = 0;
    importPath: string = './neutral/starter';

    constructor(owner: number, controller?: number, cardId?: string) {
        super(owner, controller, cardId);

        this.baseAttributes.cost = 2;

        this.baseAttributes.attack = 2;
        this.baseAttributes.health = 2;
    }
}

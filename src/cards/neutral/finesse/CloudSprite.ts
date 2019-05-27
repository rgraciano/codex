import { TechLevel, Attributes, Unit } from '../../card';
import * as Color from '../../color';

export class CloudSprite extends Unit {
    protected baseAttributes = new Attributes();

    color: Color.ColorName = 'Neutral';
    spec: Color.Spec = 'Finesse';
    flavorType = 'Fairy';
    name: string = 'Cloud Sprite';
    techLevel: TechLevel = 2;
    importPath: string = './neutral/finesse';

    constructor(owner: number, controller?: number, cardId?: string) {
        super(owner, controller, cardId);

        this.baseAttributes.cost = 2;

        this.baseAttributes.attack = 3;
        this.baseAttributes.health = 2;

        this.baseAttributes.flying = 1;
    }
}

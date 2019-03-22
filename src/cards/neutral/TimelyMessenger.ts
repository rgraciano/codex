import { TechLevel, Attributes, Unit } from '../card';
import { Game, EventDescriptor } from '../../game';
import * as Color from '../color';

export class TimelyMessenger extends Unit {
    protected baseAttributes = new Attributes();

    color: Color.ColorName = 'Neutral';
    spec: Color.Spec = 'Starter';
    flavorType = 'Mercenary';
    name: string = 'Timely Messenger';
    techLevel: TechLevel = 0;
    importPath: string = './neutral';

    constructor(owner: number, controller?: number, cardId?: string) {
        super(owner, controller, cardId);
        this.baseAttributes.health = 1;
        this.baseAttributes.attack = 1;
        this.baseAttributes.cost = 1;
        this.baseAttributes.haste = 1;
    }
}

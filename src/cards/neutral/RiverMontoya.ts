import { TechLevel, Attributes } from '../card';
import { Hero } from '../hero';
import { Game, EventDescriptor } from '../../game';
import * as Color from '../color';

export class RiverMontoya extends Hero {
    protected baseAttributes = new Attributes();

    color: Color.ColorName = 'Neutral';
    spec: Color.Spec = 'Starter';
    flavorType: string = 'Dancing Fencer';
    name: string = 'River Montoya';
    techLevel: TechLevel = 0;
    importPath: string = './neutral';

    attackMinMidMax = [2, 2, 3];
    healthMinMidMax = [3, 4, 4];

    midLevel = 3;
    maxLevel = 5;

    constructor(owner: number, controller?: number, cardId?: string) {
        super(owner, controller, cardId);

        this.baseAttributes.health = 3;
        this.baseAttributes.attack = 2;
        this.baseAttributes.cost = 2;
    }
}

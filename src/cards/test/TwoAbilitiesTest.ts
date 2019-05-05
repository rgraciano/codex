import { Card, TechLevel, Attributes, Unit } from '../card';
import { Ability, AddPlusOneOneAbility, DestroyAbility, TargetingOptions } from '../ability';
import { Game, EventDescriptor } from '../../game';
import * as Color from '../color';
import { CardApi } from '../card_api';

export class TwoAbilitiesTest extends Unit {
    protected baseAttributes = new Attributes();

    color: Color.ColorName = 'Neutral';
    spec: Color.Spec = 'Starter';
    flavorType: string = 'Virtuoso';
    name: string = 'All The Abilities';
    techLevel: TechLevel = 0;
    importPath: string = './test';

    constructor(owner: number, controller?: number, cardId?: string) {
        super(owner, controller, cardId);
        this.baseAttributes.health = 1;
        this.baseAttributes.attack = 1;
        this.baseAttributes.cost = 0;

        this.registerAbility(new AddPlusOneOneAbility(this, new TargetingOptions()));
        this.registerAbility(new DestroyAbility(this, new TargetingOptions()));
    }
}

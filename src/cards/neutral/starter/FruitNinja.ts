import { Card, TechLevel, Attributes, Unit } from '../../card';
import * as Color from '../../color';
import { ArrivesHandler } from '../../handlers';
import { EventDescriptor } from 'game';
import { DamageAnyBuildingAbility, RepairAnyBuildingAbility } from '../../ability';

export class FruitNinja extends Unit {
    protected baseAttributes = new Attributes();

    color: Color.ColorName = 'Neutral';
    spec: Color.Spec = 'Starter';
    flavorType = 'Ninja';
    name: string = 'Fruit Ninja';
    techLevel: TechLevel = 0;
    importPath: string = './neutral/starter';

    constructor(owner: number, controller?: number, cardId?: string) {
        super(owner, controller, cardId);

        this.baseAttributes.cost = 3;

        this.baseAttributes.attack = 2;
        this.baseAttributes.health = 2;

        this.baseAttributes.frenzy = 1;
    }
}

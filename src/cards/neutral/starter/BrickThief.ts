import { Card, TechLevel, Attributes, Unit } from '../../card';
import * as Color from '../../color';
import { ArrivesHandler } from '../../handlers';
import { EventDescriptor } from 'game';
import { DamageAnyBuildingAbility, RepairAnyBuildingAbility } from '../../ability';

export class BrickThief extends Unit implements ArrivesHandler {
    protected baseAttributes = new Attributes();

    color: Color.ColorName = 'Neutral';
    spec: Color.Spec = 'Starter';
    flavorType = 'Mercenary';
    name: string = 'Brick Thief';
    techLevel: TechLevel = 0;
    importPath: string = './neutral/starter';

    constructor(owner: number, controller?: number, cardId?: string) {
        super(owner, controller, cardId);

        this.baseAttributes.cost = 2;

        this.baseAttributes.attack = 2;
        this.baseAttributes.health = 1;

        this.baseAttributes.resist = 1;
    }

    onArrives(arrivingCard: Card): EventDescriptor {
        if (arrivingCard != this) return undefined;

        // Use the repair ability (first on stack means this happens second)
        let repairAbility = new RepairAnyBuildingAbility(this, 1);
        this.registerHandlerAbility(repairAbility);
        repairAbility.use();

        // Use the damage ability (last on stack means this happens first)
        let dmgAbility = new DamageAnyBuildingAbility(this, 1);
        this.registerHandlerAbility(dmgAbility);
        dmgAbility.use();
    }
}

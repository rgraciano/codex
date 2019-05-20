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

    repairAbility: RepairAnyBuildingAbility = undefined;
    dmgAbility: DamageAnyBuildingAbility = undefined;

    constructor(owner: number, controller?: number, cardId?: string) {
        super(owner, controller, cardId);

        this.baseAttributes.cost = 2;

        this.baseAttributes.attack = 2;
        this.baseAttributes.health = 1;

        this.baseAttributes.resist = 1;

        this.repairAbility = new RepairAnyBuildingAbility(this, 1);
        this.registerHandlerAbility(this.repairAbility);

        this.dmgAbility = new DamageAnyBuildingAbility(this, 1);
        this.registerHandlerAbility(this.dmgAbility);
    }

    onArrives(arrivingCard: Card): EventDescriptor {
        if (arrivingCard != this) return undefined;

        // Use the repair ability (first on stack means this happens second)
        this.repairAbility.use();
        // Use the damage ability (last on stack means this happens first)
        this.dmgAbility.use();
    }
}

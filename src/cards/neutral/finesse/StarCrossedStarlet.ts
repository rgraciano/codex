import { TechLevel, Attributes, Unit } from '../../card';
import * as Color from '../../color';
import { UpkeepHandler } from '../../handlers';
import { EventDescriptor } from 'game';

export class StarCrossedStarlet extends Unit implements UpkeepHandler {
    protected baseAttributes = new Attributes();

    color: Color.ColorName = 'Neutral';
    spec: Color.Spec = 'Finesse';
    flavorType = 'Virtuoso';
    name: string = 'Star-Crossed Starlet';
    techLevel: TechLevel = 1;
    importPath: string = './neutral/finesse';

    constructor(owner: number, controller?: number, cardId?: string) {
        super(owner, controller, cardId);

        this.baseAttributes.cost = 2;

        this.baseAttributes.attack = 3;
        this.baseAttributes.health = 2;
    }

    get allAttack(): number {
        return super.allAttack + this.effective().damage;
    }

    onUpkeep(): EventDescriptor {
        return this.gainProperty('damage');
    }
}

import { Card, TechLevel, Attributes, Unit } from '../../card';
import * as Color from '../../color';
import { GlobalBonusHook, CardCostAlteration } from '../../handlers';
import { EventDescriptor } from '../../../game';
import { DamageAnyBuildingAbility } from '../../ability';

export class Maestro extends Unit implements GlobalBonusHook, CardCostAlteration {
    protected baseAttributes = new Attributes();

    color: Color.ColorName = 'Neutral';
    spec: Color.Spec = 'Finesse';
    flavorType = 'Thespian';
    name: string = 'Maestro';
    techLevel: TechLevel = 2;
    importPath: string = './neutral/finesse';

    constructor(owner: number, controller?: number, cardId?: string) {
        super(owner, controller, cardId);

        this.baseAttributes.cost = 3;

        this.baseAttributes.attack = 3;
        this.baseAttributes.health = 5;
    }

    alterCost(card: Card): number {
        if (this.isYourCardAndFlavorType(card, 'Virtuoso')) return -card.effective().cost;
        return 0;
    }

    giveBonus(card: Card): EventDescriptor {
        return this.doIfYourCardAndFlavorType(card, 'Virtuoso', card => Maestro.setupMaestroAbility(card));
    }

    removeBonus(card: Card): EventDescriptor {
        return this.doIfYourCardAndFlavorType(card, 'Virtuoso', card => {
            card.unregisterAbility(Card.maestroAbilityName);
            return new EventDescriptor('Info', card.name + ' lost Maestro building damage ability');
        });
    }
}

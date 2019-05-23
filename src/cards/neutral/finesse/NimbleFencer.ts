import { Card, TechLevel, Attributes, Unit } from '../../card';
import * as Color from '../../color';
import { GlobalBonusHook } from '../../handlers';
import { EventDescriptor } from 'game';

export class NimbleFencer extends Unit implements GlobalBonusHook {
    protected baseAttributes = new Attributes();

    color: Color.ColorName = 'Neutral';
    spec: Color.Spec = 'Finesse';
    flavorType = 'Virtuoso';
    name: string = 'Nimble Fencer';
    techLevel: TechLevel = 1;
    importPath: string = './neutral/finesse';

    constructor(owner: number, controller?: number, cardId?: string) {
        super(owner, controller, cardId);

        this.baseAttributes.cost = 2;

        this.baseAttributes.attack = 2;
        this.baseAttributes.health = 3;
    }

    giveBonus(card: Card): EventDescriptor {
        return this.doIfYourCardAndFlavorType(card, 'Virtuoso', card => card.gainProperty('haste'));
    }

    removeBonus(card: Card): EventDescriptor {
        return this.doIfYourCardAndFlavorType(card, 'Virtuoso', card => card.loseProperty('haste'));
    }
}

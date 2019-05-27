import { Card, TechLevel, Attributes, Unit } from '../../card';
import * as Color from '../../color';
import { GlobalBonusHook } from 'cards/handlers';
import { EventDescriptor } from 'game';

export class Blademaster extends Unit implements GlobalBonusHook {
    protected baseAttributes = new Attributes();

    color: Color.ColorName = 'Neutral';
    spec: Color.Spec = 'Finesse';
    flavorType = 'Virtuoso';
    name: string = 'Blademaster';
    techLevel: TechLevel = 3;
    importPath: string = './neutral/finesse';

    constructor(owner: number, controller?: number, cardId?: string) {
        super(owner, controller, cardId);

        this.baseAttributes.cost = 6;

        this.baseAttributes.attack = 7;
        this.baseAttributes.health = 5;
    }

    giveBonus(card: Card): EventDescriptor {
        return this.doIfYourCard(card, card => card.gainProperty('swiftStrike'));
    }

    removeBonus(card: Card): EventDescriptor {
        return this.doIfYourCard(card, card => card.loseProperty('swiftStrike'));
    }
}

import { TechLevel, Attributes, Unit } from '../../card';
import * as Color from '../../color';
import { GlobalBonusHook } from '../../handlers';
import { EventDescriptor } from 'game';
import { Card } from '../../card';

export class GroundedGuide extends Unit implements GlobalBonusHook {
    protected baseAttributes = new Attributes();

    color: Color.ColorName = 'Neutral';
    spec: Color.Spec = 'Finesse';
    flavorType = 'Thespian';
    name: string = 'Grounded Guide';
    techLevel: TechLevel = 2;
    importPath: string = './neutral/finesse';

    constructor(owner: number, controller?: number, cardId?: string) {
        super(owner, controller, cardId);

        this.baseAttributes.cost = 5;

        this.baseAttributes.attack = 4;
        this.baseAttributes.health = 4;
    }

    private adjustBonus(card: Card, gain = true): EventDescriptor {
        let gaveVirtuosoBonus = this.doIfYourCardAndFlavorType(card, 'Virtuoso', card =>
            card.adjustProperties([['attack', 2], ['health', 1]])
        );

        return gaveVirtuosoBonus
            ? gaveVirtuosoBonus
            : this.doIfYourCard(card, card => card.adjustProperties([['attack', 1], ['health', 1]]));
    }

    giveBonus(card: Card): EventDescriptor {
        return this.adjustBonus(card, true);
    }

    removeBonus(card: Card): EventDescriptor {
        return this.adjustBonus(card, false);
    }
}

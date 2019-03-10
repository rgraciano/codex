import { Character, FlavorType, TechLevel, Attributes, Unit } from '../card';
import { GlobalBonusHook } from '../handlers';
import { Game, EventDescriptor } from '../../game';
import { CardApi } from '../card_api';
import * as Color from '../color';

export class NimbleFencerTest extends Unit implements GlobalBonusHook {
    protected baseAttributes = new Attributes();

    color: Color.ColorName = 'Neutral';
    spec: Color.Spec = 'Starter';
    flavorType: FlavorType = 'QA';
    name: string = 'Nimble Fencer Test';
    techLevel: TechLevel = 0;
    importPath: string = './test';

    constructor(owner: number, controller?: number, cardId?: string) {
        super(owner, controller, cardId);
        this.baseAttributes.health = 2;
        this.baseAttributes.attack = 3;
        this.baseAttributes.cost = 2;
    }

    giveBonus(card: Character): EventDescriptor {
        return this.doIfYourCardAndFlavorType(card, 'Virtuoso', card => card.gainProperty('haste'));
    }

    removeBonus(card: Character): EventDescriptor {
        return this.doIfYourCardAndFlavorType(card, 'Virtuoso', card => card.loseProperty('haste'));
    }
}

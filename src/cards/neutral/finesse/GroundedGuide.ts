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
        let description = gain ? 'gained' : 'lost';
        let propAdjFn = gain ? card.gainProperty : card.loseProperty;

        let gaveVirtuosoBonus = this.doIfYourCardAndFlavorType(card, 'Virtuoso', card => {
            propAdjFn('attack', 2);
            propAdjFn('health');
            return new EventDescriptor('PropAdjustment', card.name + ' ' + description + ' +2 attack / +1 health');
        });

        return gaveVirtuosoBonus
            ? gaveVirtuosoBonus
            : this.doIfYourCard(card, card => {
                  propAdjFn('attack');
                  propAdjFn('health');
                  return new EventDescriptor('PropAdjustment', card.name + ' ' + description + ' +1 attack / +1 health');
              });
    }

    giveBonus(card: Card): EventDescriptor {
        return this.adjustBonus(card, true);
    }

    removeBonus(card: Card): EventDescriptor {
        return this.adjustBonus(card, false);
    }
}

import { TechLevel, Attributes, Card } from '../../card';
import { Hero } from '../../hero';
import * as Color from '../../color';
import { SidelineAbility, TargetingOptions } from '../../ability';
import { CardCostAlteration } from '../../handlers';

export class RiverMontoya extends Hero implements CardCostAlteration {
    protected baseAttributes = new Attributes();

    color: Color.ColorName = 'Neutral';
    spec: Color.Spec = 'Finesse';
    flavorType: string = 'Dancing Fencer';
    name: string = 'River Montoya';
    techLevel: TechLevel = 0;
    importPath: string = './neutral/finesse';

    attackMinMidMax = [2, 2, 3];
    healthMinMidMax = [3, 4, 4];

    midLevel = 3;
    maxLevel = 5;

    constructor(owner: number, controller?: number, cardId?: string) {
        super(owner, controller, cardId);

        this.baseAttributes.health = 3;
        this.baseAttributes.attack = 2;
        this.baseAttributes.cost = 2;

        let sidelineOpts = new TargetingOptions();
        sidelineOpts.minTechLevel = 0;
        sidelineOpts.maxTechLevel = 1;
        sidelineOpts.spaceType = 'AllPatroller';
        sidelineOpts.includeHeroes = false;

        let sidelineAbil = new SidelineAbility(this, sidelineOpts);
        sidelineAbil.requiresExhaust = true;
        sidelineAbil.requiresHeroLvl = this.midLevel;

        this.registerAbility(sidelineAbil);
    }

    alterCost(card: Card): number {
        if (this.level == this.maxLevel && card.controller == this.controller && card.techLevel === 0 && card.cardType == 'Unit') return -1;
        else return 0;
    }
}

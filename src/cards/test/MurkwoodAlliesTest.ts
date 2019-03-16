import { Card, FlavorType, TechLevel, Attributes, Unit, Spell, SpellLevel } from '../card';
import { Ability, AddPlusOneOneAbility, CreateTokensAbility } from '../ability';
import { Game, EventDescriptor } from '../../game';
import * as Color from '../color';
import { CardApi } from '../card_api';

export class MurkwoodAlliesTest extends Spell {
    protected baseAttributes = new Attributes();

    color: Color.ColorName = 'Neutral';
    spec: Color.Spec = 'Starter';
    flavorType: FlavorType = 'Summon';
    spellLevel: SpellLevel = 'Normal';
    name: string = 'Murkwood Allies';
    techLevel: TechLevel = 0;
    importPath: string = './test';

    constructor(owner: number, controller?: number, cardId?: string) {
        super(owner, controller, cardId);
        this.baseAttributes.cost = 5;

        let fA = new CreateTokensAbility(this, 0, 'Frog', 4);
        let bA = new CreateTokensAbility(this, 0, 'Beast', 1);
        this.registerAbility(fA);
        this.registerAbility(bA);
        this.registerAbility(new BoostAbility(this, fA, bA));
    }
}

class BoostAbility extends Ability {
    fA: CreateTokensAbility;
    bA: CreateTokensAbility;

    constructor(card: Card, frogAbility: CreateTokensAbility, beastAbility: CreateTokensAbility) {
        super(card);
        this.name = 'Boost';
        this.requiredGoldCost = 4;
        this.fA = frogAbility;
        this.bA = beastAbility;
    }

    use() {
        super.use();
        this.card.game.addEvent(new EventDescriptor('Boost', 'Paid for boost'));
        this.fA.use();
        this.bA.use();
    }
}

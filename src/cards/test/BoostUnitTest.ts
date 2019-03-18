import { Card, FlavorType, TechLevel, Attributes, Unit } from '../card';
import { Spell, SpellLevel, SpellLifecyle, MultipleChoiceSpell } from '../spell';
import { Ability, BoostAbility, DontBoostAbility, CreateTokensAbility } from '../ability';
import { Game, EventDescriptor } from '../../game';
import * as Color from '../color';
import { CardApi } from '../card_api';

export class BoostUnitTest extends Unit {
    protected baseAttributes = new Attributes();

    ability1 = new CreateTokensAbility(this, 0, 'Frog', 4);
    ability2 = new CreateTokensAbility(this, 0, 'Beast', 1);

    color: Color.ColorName = 'Neutral';
    spec: Color.Spec = 'Starter';
    flavorType: FlavorType = 'Virtuoso';
    name: string = 'Boost Test';
    techLevel: TechLevel = 0;
    importPath: string = './test';

    constructor(owner: number, controller?: number, cardId?: string) {
        super(owner, controller, cardId);
        this.baseAttributes.cost = 1;
        this.baseAttributes.attack = 1;
        this.baseAttributes.health = 1;

        this.registerStagingAbility(
            new BoostAbility(this, 2, () => {
                this.gainProperty('attack', 5);
            })
        );
        this.registerStagingAbility(new DontBoostAbility(this));
    }
}

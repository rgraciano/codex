import { Card, FlavorType, TechLevel, Attributes, Unit } from '../card';
import { Spell, SpellLevel, SpellLifecyle, MultipleChoiceSpell } from '../spell';
import { Ability, BoostAbility, DontBoostAbility, CreateTokensAbility } from '../ability';
import { Game, EventDescriptor } from '../../game';
import * as Color from '../color';
import { CardApi } from '../card_api';

export class MurkwoodAlliesTest extends MultipleChoiceSpell {
    protected baseAttributes = new Attributes();

    ability1 = new CreateTokensAbility(this, 0, 'Frog', 4);
    ability2 = new CreateTokensAbility(this, 0, 'Beast', 1);

    color: Color.ColorName = 'Neutral';
    spec: Color.Spec = 'Starter';
    flavorType: FlavorType = 'Summon';
    spellLevel: SpellLevel = 'Normal';
    name: string = 'Murkwood Allies';
    techLevel: TechLevel = 0;
    importPath: string = './test';
    spellLifecycle: SpellLifecyle = 'MultipleChoice';

    constructor(owner: number, controller?: number, cardId?: string) {
        super(owner, controller, cardId);
        this.baseAttributes.cost = 5;

        this.registerAbility(this.ability1, true);
        this.registerAbility(this.ability2, true);
        this.registerAbility(
            new BoostAbility(this, 4, () => {
                this.ability1.use();
                this.ability2.use();
            }),
            true
        );
    }
}

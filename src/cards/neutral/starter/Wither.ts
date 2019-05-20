import { Card, Attributes, TechLevel } from '../../card';
import { Spell, SpellLevel, SpellLifecyle, ImmediateSpell } from '../../spell';
import { WouldDieHook } from '../../handlers';
import { Game, EventDescriptor } from '../../../game';
import { CardApi } from '../../card_api';
import * as Color from '../../color';
import { Ability, DamageCharacterAbility, AddMinusOneOneAbility, TargetingOptions } from '../../ability';

export class Wither extends ImmediateSpell {
    protected baseAttributes = new Attributes();

    color: Color.ColorName = 'Neutral';
    spec: Color.Spec = 'Starter';
    flavorType: string = 'Debuff';
    name: string = 'Wither';
    importPath: string = './neutral/starter';
    spellLevel: SpellLevel = 'Tech 0';
    techLevel: TechLevel = 0;
    spellLifecycle: SpellLifecyle = 'Immediate';

    castAbility: Ability;

    constructor(owner: number, controller?: number, cardId?: string) {
        super(owner, controller, cardId);
        this.baseAttributes.cost = 1;

        this.castAbility = new AddMinusOneOneAbility(this, new TargetingOptions());
        this.castAbility.targetingOptions.spaceType = 'PlayerActive';
        this.castAbility.targetingOptions.includeHeroes = true;
    }
}

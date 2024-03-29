import { Card, Attributes, TechLevel } from '../card';
import { Spell, SpellLevel, SpellLifecyle } from '../spell';
import { WouldDieHook } from '../handlers';
import { Game, EventDescriptor } from '../../game';
import { CardApi } from '../card_api';
import * as Color from '../color';

export class SoulStoneTest extends Spell implements WouldDieHook {
    protected baseAttributes = new Attributes();

    color: Color.ColorName = 'Neutral';
    spec: Color.Spec = 'Starter';
    flavorType: string = 'QA';
    name: string = 'Soul Stone Test';
    importPath: string = './test';
    spellLevel: SpellLevel = 'Normal';
    techLevel: TechLevel = 1;
    spellLifecycle: SpellLifecyle = 'Attachment';

    constructor(owner: number, controller?: number, cardId?: string) {
        super(owner, controller, cardId);
        this.baseAttributes.cost = 2;
    }

    wouldDie(cardToDie: Card): EventDescriptor {
        if (this.contains.find(card => card == cardToDie)) {
            cardToDie.attributeModifiers.damage = 0;
            cardToDie.attributeModifiers.plusOneOne--;

            //  this.game.removeCardFromPlay(this); // TODO: this is dangerous, use CardApi instead
            // this.ownerBoard.discard.push(this);

            return new EventDescriptor('WouldDie', 'Soul Stone prevented the death of ' + cardToDie.cardId);
        }
        return undefined;
    }
}

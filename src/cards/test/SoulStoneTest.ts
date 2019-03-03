

import { Card, Spell, FlavorType, Attributes, WouldDieHook, SpellLevel, TechLevel } from '../card';
import { Game, EventDescriptor } from '../../game';
import { CardApi } from '../card_api';
import * as Color from '../color';

export class SoulStoneTest extends Spell implements WouldDieHook {
    protected baseAttributes = new Attributes();

    color: Color.ColorName = 'Neutral';
    spec: Color.Spec = 'Starter';
    flavorType: FlavorType = "QA";
    name: string = "Soul Stone Test";
    importPath: string = "./test";
    spellLevel: SpellLevel = 'Normal';
    techLevel: TechLevel = 'Tech 1';
    
    constructor(owner: number, controller?: number, cardId?: string) {
        super(owner, controller, cardId);
        this.baseAttributes.cost = 2;
    }

    wouldDie(cardToDie: Card): EventDescriptor {
        if (this.contains.find(card => card == cardToDie)) {
           cardToDie.attributeModifiers.damage = 0;
           cardToDie.attributeModifiers.plusOneOne--;
           
           this.game.removeCardFromPlay(this);
           this.ownerBoard.discard.push(this);
           
           return new EventDescriptor('WouldDie', 'Soul Stone prevented the death of ' + cardToDie.cardId);
        }
        return undefined;
    }
}
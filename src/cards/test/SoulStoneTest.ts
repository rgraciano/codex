

import { Card, Spell, Color, FlavorType, Attributes, WouldDieHook } from '../card';
import { Game, EventDescriptor } from '../../game';
import { CardApi } from '../../actions/card_api';

export class SoulStoneTest extends Spell implements WouldDieHook {
    protected baseAttributes = new Attributes();

    color: Color = "Black";
    flavorType: FlavorType = "QA";
    name: string = "Soul Stone Test";
    importPath: string = "./test";

    constructor(game: Game, owner: number, controller?: number, cardId?: string) {
        super(game, owner, controller, cardId);
        this.baseAttributes.cost = 2;
    }

    wouldDie(cardToDie: Card): EventDescriptor {
        if (this.contains.find(card => card == cardToDie)) {
           cardToDie.attributeModifiers.damage = 0;
           cardToDie.attributeModifiers.plusOneOne--;
           
           CardApi.discardCard(this, this.game);
        }
        return undefined;
    }
}
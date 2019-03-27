import { Card, TechLevel, Attributes, Unit } from '../card';
import { Ability, AddPlusOneOneAbility } from '../ability';
import { Game, EventDescriptor } from '../../game';
import * as Color from '../color';
import { CardApi } from '../card_api';

export class TwoAbilitiesTest extends Unit {
    protected baseAttributes = new Attributes();

    color: Color.ColorName = 'Neutral';
    spec: Color.Spec = 'Starter';
    flavorType: string = 'Virtuoso';
    name: string = 'All The Abilities';
    techLevel: TechLevel = 0;
    importPath: string = './test';

    constructor(owner: number, controller?: number, cardId?: string) {
        super(owner, controller, cardId);
        this.baseAttributes.health = 1;
        this.baseAttributes.attack = 1;
        this.baseAttributes.cost = 0;

        this.registerAbility(new AddPlusOneOneAbility(this, 0, 3, 3));
        this.registerAbility(new DestroyAbility(this));
    }
}

class DestroyAbility extends Ability {
    name: string;
    constructor(card: Card) {
        super(card);
        this.name = 'Destroy';
    }

    use() {
        super.use();
        return this.choose(undefined, this.choicesUnits(this.card.game.getAllActiveCards(), 0, 0), 2, 'Destroy', true, true);
    }

    resolveChoice(cardOrBuildingId: string) {
        let card = Card.idToCardMap.get(cardOrBuildingId);
        CardApi.destroyCard(card);
        return new EventDescriptor('Ability', 'Marked ' + card.name + ' for destruction');
    }
}

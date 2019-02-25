
import { Character, Color, FlavorType, TechLevel, Attributes, Unit, GlobalBonusHook } from '../card';
import { Game, EventDescriptor } from '../../game';
import { CardApi } from '../../actions/card_api';

export class NimbleFencerTest extends Unit implements GlobalBonusHook {
    protected baseAttributes = new Attributes();

    color: Color = "Neutral";
    flavorType: FlavorType = "QA";
    name: string = "Nimble Fencer Test";
    techLevel: TechLevel = "Tech 0";
    importPath: string = "./test";

    constructor(game: Game, owner: number, controller?: number, cardId?: string) {
        super(game, owner, controller, cardId);
        this.baseAttributes.health = 2;
        this.baseAttributes.attack = 3;
        this.baseAttributes.cost = 2;
    }

    giveBonus(card: Character): EventDescriptor {
        return this.doIfYourCardAndFlavorType(card, 'Virtuoso', card => card.gainProperty('haste'));
    }

    removeBonus(card: Character): EventDescriptor {
        return this.doIfYourCardAndFlavorType(card, 'Virtuoso', card => card.loseProperty('haste'));
    }
}


import { Card, TechLevel, Unit, Color, FlavorType, Attributes, DiesHandler } from '../card';
import { Game, EventDescriptor } from '../../game';

export class CapturedBugblatterTest extends Unit implements DiesHandler {
    protected baseAttributes = new Attributes();

    color: Color = "Red";
    flavorType: FlavorType = "Beast";
    name: string = "Captured Bugblatter Test";
    techLevel: TechLevel = "Tech 2";
    importPath: string = "./test";

    constructor(game: Game, owner: number, controller?: number, cardId?: string) {
        super(game, owner, controller, cardId);
        this.baseAttributes.cost = 2;
    }

    onDies(dyingCard: Card): EventDescriptor {
        if (dyingCard.cardType == 'Unit') {
           return this.oppositionalControllerBoard.base.damage(1, this);
        }
        return undefined;
    }
}
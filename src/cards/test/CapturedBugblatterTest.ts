

import { Card, TechLevel, Unit, FlavorType, Attributes, DiesHandler } from '../card';
import { Game, EventDescriptor } from '../../game';
import * as Color from '../color';

export class CapturedBugblatterTest extends Unit implements DiesHandler {
    protected baseAttributes = new Attributes();

    color: Color.ColorName = 'Neutral';
    spec: Color.Spec = 'Starter';
    flavorType: FlavorType = "Beast";
    name: string = "Captured Bugblatter Test";
    techLevel: TechLevel = "Tech 2";
    importPath: string = "./test";

    constructor(owner: number, controller?: number, cardId?: string) {
        super(owner, controller, cardId);
        this.baseAttributes.cost = 2;
    }

    onDies(dyingCard: Card): EventDescriptor {
        if (dyingCard.cardType == 'Unit') {
           return this.oppositionalControllerBoard.base.damage(1, this);
        }
        return undefined;
    }
}
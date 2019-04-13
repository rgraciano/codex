import { Card, TechLevel, Unit, Attributes } from '../card';
import { DiesHandler } from '../handlers';
import { Game, EventDescriptor } from '../../game';
import * as Color from '../color';

export class CapturedBugblatterTest extends Unit implements DiesHandler {
    protected baseAttributes = new Attributes();

    color: Color.ColorName = 'Neutral';
    spec: Color.Spec = 'Starter';
    flavorType: string = 'Beast';
    name: string = 'Captured Bugblatter Test';
    techLevel: TechLevel = 2;
    importPath: string = './test';

    constructor(owner: number, controller?: number, cardId?: string) {
        super(owner, controller, cardId);
        this.baseAttributes.cost = 2;
    }

    onDies(dyingCard: Card): EventDescriptor {
        if (dyingCard.cardType == 'Unit') {
            return this.oppControllerBoard.base.damage(1, this);
        }
        return undefined;
    }
}

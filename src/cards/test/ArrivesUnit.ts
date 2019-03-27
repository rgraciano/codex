import { Card, TechLevel, Attributes, Unit } from '../card';
import { ArrivesHandler } from '../handlers';
import { Game, EventDescriptor } from '../../game';
import * as Color from '../color';

export class ArrivesUnit extends Unit implements ArrivesHandler {
    protected baseAttributes = new Attributes();

    color: Color.ColorName = 'Neutral';
    spec: Color.Spec = 'Starter';
    flavorType: string = 'Virtuoso';
    name: string = 'Mr Arrives';
    techLevel: TechLevel = 0;
    importPath: string = './test';

    constructor(owner: number, controller?: number, cardId?: string) {
        super(owner, controller, cardId);
        this.baseAttributes.health = 1;
        this.baseAttributes.attack = 1;
        this.baseAttributes.cost = 1;
    }

    onArrives(arrivingCard: Card): EventDescriptor {
        return this.doIfThisCard(arrivingCard, arrivingCard => arrivingCard.gainProperty('plusOneOne'));
    }
}

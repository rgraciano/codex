
import { Card, FlavorType, TechLevel, Attributes, Unit, ArrivesHandler } from '../card';
import { Game, EventDescriptor } from '../../game';
import * as Color from '../color';

export class ArrivesUnit extends Unit implements ArrivesHandler {
    protected baseAttributes = new Attributes();

    color: Color.ColorName = 'Neutral';
    spec: Color.Spec = 'Starter';
    flavorType: FlavorType = "Virtuoso";
    name: string = "Mr Arrives";
    techLevel: TechLevel = "Tech 0";
    importPath: string = "./test";

    constructor(game: Game, owner: number, controller?: number, cardId?: string) {
        super(game, owner, controller, cardId);
        this.baseAttributes.health = 1;
        this.baseAttributes.attack = 1;
        this.baseAttributes.cost = 1;
    }

    onArrives(arrivingCard: Card): EventDescriptor {
        return this.doIfThisCard(arrivingCard, (arrivingCard) => arrivingCard.gainProperty('plusOneOne'));
    }
}

import { Color, FlavorType, TechLevel, Attributes, Unit, ArrivesHandler } from '../card';
import { EventDescriptor } from '../../game';
import { CardApi } from '../../actions/card_api';

export class ArrivesUnit extends Unit implements ArrivesHandler {
    protected baseAttributes = new Attributes();

    color: Color = "Neutral";
    flavorType: FlavorType = "QA";
    name: string = "Mr Arrives";
    techLevel: TechLevel = "Tech 0";
    importPath: string = "./test";

    constructor(owner: number, controller?: number, cardId?: string) {
        super(owner, controller, cardId);
        this.baseAttributes.health = 1;
        this.baseAttributes.attack = 1;
        this.baseAttributes.cost = 1;
    }

    onArrives(): EventDescriptor {
        return CardApi.gainMarkerOrRune(this, 1, 'plusOneOne');
    }
}
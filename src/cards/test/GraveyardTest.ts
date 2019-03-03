


import { Unit, Card, Building, FlavorType, Attributes, WouldDiscardHook, TechLevel } from '../card';
import { Game, EventDescriptor } from '../../game';
import * as Color from '../color';

export class GraveyardTest extends Building implements WouldDiscardHook {
    protected baseAttributes = new Attributes();

    color: Color.ColorName = 'Neutral';
    spec: Color.Spec = 'Starter';
    flavorType: FlavorType = "QA";
    name: string = "Graveyard Test";
    importPath: string = "./test";
    techLevel: TechLevel = 'Tech 0';

    constructor(owner: number, controller?: number, cardId?: string) {
        super(owner, controller, cardId);
        this.baseAttributes.cost = 2;
        this.baseAttributes.health = 3;
    }

    wouldDiscard(cardToDiscard: Card): EventDescriptor {
        if (cardToDiscard.controller === this.controller && cardToDiscard.cardType == 'Unit' && !(<Unit>cardToDiscard).isToken) {
            if (this.contains.length == 3) {
                this.ownerBoard.discard.push(this);
                cardToDiscard.ownerBoard.discard.push(this);

                let discardedCards = this.name + ', ' + cardToDiscard.name;
                let discardedIds: String[] = [ this.cardId, cardToDiscard.cardId ];

                this.contains.map(buried => { 
                    buried.ownerBoard.discard.push(buried);
                    discardedCards += ', ' + buried.name;  
                    discardedIds.push(buried.cardId);
                });

                this.contains = [];

                return new EventDescriptor('DiscardedCards', 'Graveyard met its 4 card limit and broke.  Discarded: ' + discardedCards, { discardedCardIds: discardedIds });    
            }
            else {
                this.contains.push(cardToDiscard);
                return new EventDescriptor('Graveyard', 'Graveyard prevented ' + cardToDiscard.name + ' from going to discard', { graveyardId: this.cardId, cardToDiscardId: cardToDiscard.cardId } );
            }
        }

        return undefined;
    }
}
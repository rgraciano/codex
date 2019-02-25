


import { Unit, Card, Building, Color, FlavorType, Attributes, WouldDiscardHook } from '../card';
import { Game, EventDescriptor } from '../../game';

export class GraveyardTest extends Building implements WouldDiscardHook {
    protected baseAttributes = new Attributes();

    color: Color = "Black";
    flavorType: FlavorType = "QA";
    name: string = "Graveyard Test";
    importPath: string = "./test";

    constructor(game: Game, owner: number, controller?: number, cardId?: string) {
        super(game, owner, controller, cardId);
        this.baseAttributes.cost = 2;
        this.baseAttributes.health = 3;
    }

    wouldDiscard(cardToDiscard: Card): EventDescriptor {
        let discard: Card[] = cardToDiscard.controller == 1 ? this.game.player1Board.discard : this.game.player2Board.discard;

        if (cardToDiscard.controller === this.controller && cardToDiscard.cardType == 'Unit' && !(<Unit>cardToDiscard).isToken) {
            if (this.contains.length == 3) {
                discard.push(this);
                discard.push(cardToDiscard);

                let discardedCards = this.name + ', ' + cardToDiscard.name;
                let discardedIds: String[] = [ this.cardId, cardToDiscard.cardId ];

                this.contains.map(buried => { 
                    discard.push(buried); 
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
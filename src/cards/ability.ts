import { Card, Attributes } from './card';
import { EventDescriptor } from 'game';

export abstract class Ability {
    name: string = 'Ability';
    card: Card;

    requiredGoldCost = 0;
    requiresExhaust = false;
    requiredRuneType: keyof Attributes = undefined;
    requiresNumRunes = 0;

    constructor(card: Card) {
        this.card = card;
    }

    canUse(): boolean {
        if (this.card.controllerBoard.gold < this.requiredGoldCost) return false;

        let attrs = this.card.effective();

        if (this.requiresExhaust && (attrs.arrivalFatigue || attrs.exhausted)) return false;

        if (this.requiredRuneType && attrs[this.requiredRuneType] <= this.requiresNumRunes) return false;

        return true;
    }

    payFor() {
        if (!this.canUse()) throw new Error('Could not pay for ' + this.name + ' ability');

        this.card.controllerBoard.gold -= this.requiredGoldCost;

        let attrs = this.card.effective();

        if (this.requiresExhaust) attrs.exhausted++;

        if (this.requiredRuneType) attrs[this.requiredRuneType] -= this.requiresNumRunes;
    }

    abstract use(): EventDescriptor; // always enters an ability phase?

    abstract resolve(): EventDescriptor; // always clears ability phase?
}

import { Card, Attributes, TechLevel } from './card';
import { EventDescriptor } from 'game';
import { Phase } from 'actions/phase';
import { BuildingType, BoardBuilding } from 'board';

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

    /** For numberRequired, use 0 to indicate ALL */
    choose(buildings: BuildingType[], cards: Card[], chooseNumber: number, choicesRequired = true, usesTargetingRules = true) {
        let phaseStack = this.card.game.phaseStack;

        if (usesTargetingRules && cards)
            cards.filter(card => {
                let eff = card.effective();
                if (eff.untargetable) return false;
                else if (card.controller != card.game.activePlayer && eff.invisible) return false;
                else return true;
            });

        phaseStack.addToStack(new Phase('ChooseAbilityTarget', ['AbilityChoice']));
    }

    choicesUnits(space: Card[], leastTechLevel?: TechLevel, mostTechLevel?: TechLevel, extraFilter?: (card: Card) => boolean): Card[] {
        return this.choicesCharacters(space, true, false, leastTechLevel, mostTechLevel, extraFilter);
    }

    choicesHeroes(space: Card[], leastTechLevel?: TechLevel, mostTechLevel?: TechLevel, extraFilter?: (card: Card) => boolean): Card[] {
        return this.choicesCharacters(space, false, true, leastTechLevel, mostTechLevel, extraFilter);
    }

    choicesUnitsOrHeroes(
        space: Card[],
        leastTechLevel?: TechLevel,
        mostTechLevel?: TechLevel,
        extraFilter?: (card: Card) => boolean
    ): Card[] {
        return this.choicesCharacters(space, true, true, leastTechLevel, mostTechLevel, extraFilter);
    }

    choicesCharacters(
        space: Card[],
        includeUnits = true,
        includeHeroes = true,
        leastTechLevel?: TechLevel,
        mostTechLevel?: TechLevel,
        extraFilter?: (card: Card) => boolean
    ): Card[] {
        return space.filter(card => {
            if (leastTechLevel !== undefined && leastTechLevel > card.techLevel) return false;
            else if (mostTechLevel !== undefined && mostTechLevel < card.techLevel) return false;
            else if (extraFilter && !extraFilter(card)) return false;
            else if (includeUnits && card.cardType == 'Unit') return true;
            else if (includeHeroes && card.cardType == 'Hero') return true;
            else return false;
        });
    }

    /**
     * Note this may return more than numberWeakest targets if there's a tie, and the user will have to choose.
     * Normally this isn't a targeting thing; it automatically happens to the weakest things.
     */
    choicesWeakest(space: Card[], numberWeakest: number, usesTargetingRules: boolean, useAttack = true): Card[] {
        let filtered = space.filter(card => card.cardType != 'Unit');

        // pick weakest tech level, using attack as a tie-breaker (if applicable). ties are still possible though
        filtered.sort((card1: Card, card2: Card) => {
            if (card1.techLevel < card2.techLevel) return -1;
            else if (card1.techLevel > card2.techLevel) return 1;
            else if (useAttack) return card1.effective().attack - card2.effective().attack;
            else return 0;
        });

        // select the first numberWeakest cards
        let selectedCards: Card[] = [];

        for (let i = 0; i < filtered.length; i++) {
            let curCard = filtered[i];

            if (selectedCards.length < numberWeakest) selectedCards.push(curCard);
            else {
                let strongestCard = selectedCards[numberWeakest - 1];
                if (strongestCard.techLevel == curCard.techLevel) {
                    if (!useAttack || strongestCard.effective().attack == curCard.effective().attack) selectedCards.push(curCard);
                }
            }
        }

        return selectedCards;
    }

    abstract resolveChoice(): EventDescriptor;

    abstract use(): EventDescriptor; // always enters an ability phase?
}

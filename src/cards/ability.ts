import { Card, Attributes, TechLevel } from './card';
import { EventDescriptor } from '../game';
import { Phase } from '../actions/phase';
import { BuildingType, BoardBuilding } from '../board';
import { CardApi } from './card_api';

export type BuildingChoice = { boardBuildings: BuildingType[]; cardBuildings: Card[] };

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
    choose(
        buildings: BuildingChoice,
        cards: Card[],
        chooseNumber: number,
        label: string,
        choicesRequired = true,
        usesTargetingRules = true
    ) {
        let phaseStack = this.card.game.phaseStack;

        let allCards: Card[] = [];

        if (buildings && buildings.cardBuildings) allCards = allCards.concat(buildings.cardBuildings);
        if (cards) allCards = allCards.concat(cards);

        if (usesTargetingRules && allCards) {
            allCards.filter(card => {
                let eff = card.effective();
                if (eff.untargetable) return false;
                else if (card.controller != card.game.activePlayer && (eff.invisible && !eff.towerRevealedThisTurn)) return false;
                else if (card.controllerBoard.gold < eff.resist) return false;
                else return true;
            });
        }

        let phase = phaseStack.topOfStack();
        if (phase.name != 'ChooseAbilityTarget') {
            phase = new Phase('ChooseAbilityTarget', ['AbilityChoice']);
            phaseStack.addToStack(phase);
        }

        // can we ever choose the same thing more than once? i don't think so... and the default here is to cross things off the list
        phase.markCardsToResolve(allCards);
        if (buildings && buildings.boardBuildings) phase.markIdsToResolve(buildings.boardBuildings);

        if (!choicesRequired) phase.markIdsToResolve(['None']);

        // gives the back-end the ability to find the resolve() method for this card
        phase.extraState.cardWithAbility = this.card.cardId;
        phase.extraState.abilityName = this.name;

        // we use the choice of 'None' to end the chain when choices are not required, so we don't need to explicitly track
        // whether or not things are required
        phase.extraState.chooseNumber = chooseNumber;
        phase.extraState.haveChosen = 0;

        phase.extraState.label = label;

        phase.extraState.usesTargetingRules = usesTargetingRules;
    }

    // building choices can be built-ins, or cards
    // note buildings can be untargetable (see Hero's Monument), so we should manage that here
    // returns an array of built-in building IDs and Cards IDs
    choicesBuildings(
        includeCards: boolean,
        includeBase: boolean,
        includeAddOn: boolean,
        minTechLevel: TechLevel,
        maxTechLevel: TechLevel
    ): BuildingChoice {
        let choices: BuildingChoice = { boardBuildings: [], cardBuildings: [] };

        if (includeBase) choices.boardBuildings.push('Base');
        if (includeAddOn) choices.boardBuildings.push('AddOn');

        for (let i = minTechLevel; i <= maxTechLevel; i++) {
            if (i === 0) continue;

            choices.boardBuildings.push(<BuildingType>('Tech ' + new Number(i).toString()));
        }

        if (includeCards) choices.cardBuildings = this.card.game.getAllActiveCards().filter(card => card.cardType == 'Building');

        return choices;
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

    resolveChoice(cardOrBuildingId: string): EventDescriptor {
        return null;
    }

    use() {
        this.payFor();
    }
}

export class AddPlusOneOneAbility extends Ability {
    minTechLevel: TechLevel;
    maxTechLevel: TechLevel;
    numTargets: number;

    constructor(card: Card, minTechLevel: TechLevel, maxTechLevel: TechLevel, numTargets: number) {
        super(card);
        this.minTechLevel = minTechLevel;
        this.maxTechLevel = maxTechLevel;
        this.numTargets = numTargets;
        this.name = 'Add +1/+1';
    }

    use() {
        super.use();
        return this.choose(
            undefined,
            this.choicesUnits(this.card.game.getAllActiveCards(), this.minTechLevel, this.maxTechLevel),
            this.numTargets,
            'Add +1/+1',
            false,
            true
        );
        // need to check - what happens if ability requires more targets than actually exist?
    }

    resolveChoice(cardOrBuildingId: string) {
        let card = Card.idToCardMap.get(cardOrBuildingId);
        return card.gainProperty('plusOneOne', 1);
    }
}

export class CreateTokensAbility extends Ability {
    tokenName: string;
    numTokens: number;
    onMyBoard: boolean;

    constructor(card: Card, cost: number, tokenName: string, numTokens: number, onMyBoard: boolean = true) {
        super(card);
        this.tokenName = tokenName;
        this.numTokens = numTokens;
        this.onMyBoard = onMyBoard;
        this.requiredGoldCost = cost;
    }

    use() {
        super.use();
        CardApi.makeTokens(this.card.game, this.tokenName, this.numTokens, this.onMyBoard);
    }
}

import { Card, Attributes, TechLevel } from './card';
import { EventDescriptor, Game } from '../game';
import { Phase, Action } from '../actions/phase';
import { BuildingType, BoardBuilding } from '../board';
import { CardApi, SpaceType } from './card_api';
import { Hero } from './hero';

export type BuildingChoice = { boardBuildings: BuildingType[]; cardBuildings: Card[] };
export type ChoiceType = 'Buildings' | 'Heroes' | 'Units' | 'Characters' | 'Weakest';

export class TargetingOptions {
    minTechLevel: TechLevel = 0;
    maxTechLevel: TechLevel = 3;
    numTargets: number = 1;
    includeUnits: boolean = true;
    includeHeroes: boolean = false;
    choicesRequired: boolean = false;
    usesTargetingRules: boolean = true;
    canChooseTargetMoreThanOnce: boolean = false;
    spaceType: SpaceType = 'AllActive';
    extraFilter: (card: Card) => boolean = undefined;
}

/** Note to use and register an Ability, it must always happen in the Card constructor */
export abstract class Ability {
    abstract name: string;
    card: Card;

    targetingOptions: TargetingOptions;

    requiresHeroLvl = 0;
    requiredGoldCost = 0;
    requiresExhaust = false;
    requiredRuneType: keyof Attributes = undefined;
    requiresNumRunes = 0;
    stagingAbility: boolean = false;
    usable: boolean = true; // set to false for abilities that are triggered, like from a handler

    constructor(card: Card, targetingOptions: TargetingOptions) {
        this.card = card;
        this.targetingOptions = targetingOptions;
    }

    canUse(skipUsableCheck = false): boolean {
        if (!skipUsableCheck && !this.usable) return false;

        if (this.card.controllerBoard.gold < this.requiredGoldCost) return false;

        if (this.requiresHeroLvl && this.card instanceof Hero && (<Hero>this.card).level < this.requiresHeroLvl) return false;

        let attrs = this.card.effective();

        if (this.requiresExhaust && (attrs.arrivalFatigue || attrs.exhausted)) return false;

        if (this.requiredRuneType && attrs[this.requiredRuneType] <= this.requiresNumRunes) return false;

        // some abilities are actually choices that the user has to make when playing the card.
        // for example, Boost and Not Boost are like this
        if (this.card.game.phaseStack.topOfStack().isValidAction('StagingAbility')) return this.stagingAbility;
        else return !this.stagingAbility;
    }

    payFor() {
        if (!this.canUse(true)) throw new Error('Could not pay for ' + this.name + ' ability');

        this.card.controllerBoard.gold -= this.requiredGoldCost;

        let attrs = this.card.effective();

        if (this.requiresExhaust) attrs.exhausted++;

        if (this.requiredRuneType) attrs[this.requiredRuneType] -= this.requiresNumRunes;
    }

    /**
     * Enters a phase to choose a target for an ability
     * @chooseNumber use 0 to indicate ALL
     */
    choose(buildings: BuildingChoice, cards: Card[], label: string) {
        let phaseStack = this.card.game.phaseStack;

        let allCards: Card[] = [];

        if (buildings && buildings.cardBuildings) allCards = allCards.concat(buildings.cardBuildings);
        if (cards) allCards = allCards.concat(cards);

        // First we check for any opposing flagbearers that would have to be targeted
        let flagbearer: Card = undefined;
        if (this.targetingOptions.usesTargetingRules && allCards)
            flagbearer = allCards.find((curCard: Card) => {
                let eff = curCard.effective();
                if (eff.flagbearer <= 0) return false;
                else if (curCard.controller == curCard.game.activePlayer) return false;
                else if (eff.untargetable || eff.invisible) return false;
                else if (curCard.oppControllerBoard.gold < eff.resist) return false;
                else return true;
            });
        // If found... then ONLY flagbearers will be targeted
        if (flagbearer) allCards = [flagbearer];
        // If no flagbearers, we filter by invisible, resist, etc; eliminating impossible targets
        else if (this.targetingOptions.usesTargetingRules && allCards) {
            allCards.filter(card => {
                let eff = card.effective();
                if (eff.untargetable) return false;
                else if (card.controller != card.game.activePlayer && (eff.invisible && !eff.towerRevealedThisTurn)) return false;
                else if (card.controllerBoard.gold < eff.resist) return false;
                else return true;
            });
        }

        let action = new Action('AbilityChoice', {
            chooseNumber: this.targetingOptions.numTargets,
            canChooseTargetsMoreThanOnce: this.targetingOptions.canChooseTargetMoreThanOnce,
            mustChooseAll: false
        });
        let phase = new Phase([action]);
        phaseStack.addToStack(phase);

        // can we ever choose the same thing more than once? i don't think so... and the default here is to cross things off the list
        action.addCards(allCards);
        if (buildings && buildings.boardBuildings) action.addIds(buildings.boardBuildings);

        if (!this.targetingOptions.choicesRequired) action.addIds(['None']);

        // gives the back-end the ability to find the resolve() method for this card
        action.extraState.cardWithAbility = this.card.cardId;
        action.extraState.abilityName = this.name;

        // we use the choice of 'None' to end the chain when choices are not required, so we don't need to explicitly track
        // whether or not things are required
        action.extraState.label = label;

        action.extraState.usesTargetingRules = this.targetingOptions.usesTargetingRules;
    }

    // building choices can be built-ins, or cards
    // note buildings can be untargetable (see Hero's Monument), so we should manage that here
    // returns an array of built-in building IDs and Cards IDs
    choicesBuildings(includeCards: boolean, includeBase: boolean, includeAddOn: boolean): BuildingChoice {
        let choices: BuildingChoice = { boardBuildings: [], cardBuildings: [] };

        if (includeBase) choices.boardBuildings.push('Base');
        if (includeAddOn) choices.boardBuildings.push('AddOn');

        for (let i = this.targetingOptions.minTechLevel; i <= this.targetingOptions.maxTechLevel; i++) {
            if (i === 0) continue;

            choices.boardBuildings.push(<BuildingType>('Tech ' + new Number(i).toString()));
        }

        if (includeCards) choices.cardBuildings = this.card.game.getAllActiveCards().filter(card => card.cardType == 'Building');

        return choices;
    }

    choicesCharacters(): Card[] {
        let space = CardApi.getCardsFromSpace(this.card.game, this.targetingOptions.spaceType);
        return space.filter(card => {
            if (this.targetingOptions.minTechLevel !== undefined && this.targetingOptions.minTechLevel > card.techLevel) return false;
            else if (this.targetingOptions.maxTechLevel !== undefined && this.targetingOptions.maxTechLevel < card.techLevel) return false;
            else if (this.targetingOptions.extraFilter && !this.targetingOptions.extraFilter(card)) return false;
            else if (this.targetingOptions.includeUnits && card.cardType == 'Unit') return true;
            else if (this.targetingOptions.includeHeroes && card.cardType == 'Hero') return true;
            else return false;
        });
    }

    /**
     * Note this may return more than numberWeakest targets if there's a tie, and the user will have to choose.
     * Normally this isn't a targeting thing; it automatically happens to the weakest things.
     */
    choicesWeakest(numberWeakest: number, useAttack = true): Card[] {
        let space = CardApi.getCardsFromSpace(this.card.game, this.targetingOptions.spaceType);
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

    resolveChoice(cardOrBuildingId: string): EventDescriptor | undefined {
        return undefined;
    }

    use() {
        this.payFor();
    }
}

export abstract class CharacterChoiceAbility extends Ability {
    use() {
        super.use();
        return this.choose(undefined, this.choicesCharacters(), this.name);
    }
}

export abstract class AnyBuildingChoiceAbility extends Ability {
    use() {
        super.use();
        return this.choose(this.choicesBuildings(true, true, true), undefined, this.name);
    }
}

export class DamageAnyBuildingAbility extends AnyBuildingChoiceAbility {
    name = 'Damage Building';
    amount = 1;

    constructor(card: Card, amount: number) {
        super(card, new TargetingOptions());
        this.amount = amount;
    }

    resolveChoice(cardOrBuildingId: string) {
        let building = this.card.oppControllerBoard.getBuildingByName(cardOrBuildingId);
        let amount = CardApi.dealDirectDamage(this.amount, this.card, undefined, building);
        return new EventDescriptor(
            'DirectDamage',
            amount + ' direct damage was done to player ' + this.card.oppControllerBoard.playerNumber + ' ' + cardOrBuildingId
        );
    }
}

export class DamageCharacterAbility extends CharacterChoiceAbility {
    name = 'Damage Character';
    amount = 1;

    constructor(card: Card, amount: number) {
        super(card, new TargetingOptions());
        this.amount = amount;
    }

    resolveChoice(cardOrBuildingId: string) {
        let cardToDamage = Card.idToCardMap.get(cardOrBuildingId);
        let amount = CardApi.dealDirectDamage(this.amount, this.card, cardToDamage, undefined);
        return new EventDescriptor('DirectDamage', amount + ' direct damage was done to ' + cardToDamage.name);
    }
}

export class RepairAnyBuildingAbility extends AnyBuildingChoiceAbility {
    name = 'Repair Building';
    amount = 1;

    constructor(card: Card, amount: number) {
        super(card, new TargetingOptions());
        this.amount = amount;
    }

    resolveChoice(cardOrBuildingId: string) {
        let building = this.card.ownerBoard.getBuildingByName(cardOrBuildingId);
        let repaired = building.repair(this.amount);
        return new EventDescriptor('RepairedDamage', 'Repaired ' + repaired + ' damage from ' + cardOrBuildingId);
    }
}

export class AddPlusOneOneAbility extends CharacterChoiceAbility {
    name = 'Add +1/+1';

    resolveChoice(cardOrBuildingId: string) {
        let card = Card.idToCardMap.get(cardOrBuildingId);
        return card.gainProperty('plusOneOne', 1);
    }
}

export class AddMinusOneOneAbility extends CharacterChoiceAbility {
    name = 'Add -1/-1';

    resolveChoice(cardOrBuildingId: string) {
        let card = Card.idToCardMap.get(cardOrBuildingId);
        return card.gainProperty('minusOneOne', 1);
    }
}

export class SidelineAbility extends CharacterChoiceAbility {
    name = 'Sideline';

    resolveChoice(cardOrBuildingId: string) {
        let card = Card.idToCardMap.get(cardOrBuildingId);
        CardApi.sidelineCard(card);
        return new EventDescriptor('Sideline', 'Sidelined ' + card.name);
    }
}

export class DestroyAbility extends CharacterChoiceAbility {
    name = 'Destroy';

    resolveChoice(cardOrBuildingId: string) {
        let card = Card.idToCardMap.get(cardOrBuildingId);
        CardApi.destroyCard(card);
        return new EventDescriptor('Ability', 'Marked ' + card.name + ' for destruction');
    }
}

export class CreateTokensAbility extends Ability {
    name: string;
    tokenName: string;
    numTokens: number;
    onMyBoard: boolean;

    constructor(card: Card, cost: number, tokenName: string, numTokens: number, onMyBoard: boolean = true) {
        super(card, new TargetingOptions());
        this.name = 'Create ' + tokenName;
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

export class BoostAbility extends Ability {
    name = 'Boost';
    useFn: () => void;

    constructor(card: Card, cost: number, useFn: () => void) {
        super(card, new TargetingOptions());
        this.requiredGoldCost = cost;
        this.useFn = useFn;
    }

    use() {
        super.use();
        this.useFn();
        this.card.game.addEvent(new EventDescriptor('Boost', 'Paid for boost'));
    }
}

export class DontBoostAbility extends Ability {
    name = 'No Boost';
    constructor(card: Card) {
        super(card, new TargetingOptions());
    }
}

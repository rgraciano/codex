import { anyid } from 'anyid';
import { Game, EventDescriptor, RuneEvent } from '../game';
import { ObjectMap } from '../game_server';
import { Board } from '../board';
import { Ability, DamageAnyBuildingAbility } from './ability';
import * as Color from './color';
import { Spell } from './spell';
import { CardApi } from './card_api';
//import { Maestro } from './neutral/finesse/Maestro';

export type CardType = 'Spell' | 'Hero' | 'Unit' | 'Building' | 'Upgrade' | 'Effect' | 'None';
export type TechLevel = 0 | 1 | 2 | 3;

export abstract class Card {
    abstract readonly cardType: CardType;

    abstract readonly color: Color.ColorName;
    abstract readonly spec: Color.Spec;

    abstract readonly flavorType: string;
    abstract readonly name: string;

    abstract readonly techLevel: TechLevel;

    abilityMap: Map<string, Ability> = new Map<string, Ability>();
    stagingAbilityMap: Map<string, Ability> = new Map<string, Ability>();

    // Identifies cards uniquely, for client<->server communication
    readonly cardId: string;

    /** Some cards, like Jail or Graveyard, are containers for other cards */
    contains: Array<Card> = new Array<Card>();

    static cardToIdMap: Map<Card, string> = new Map<Card, string>();
    static idToCardMap: Map<string, Card> = new Map<string, Card>();

    // Tracks who controls this card; makes lookups easier later
    owner: number;
    controller: number;

    // Path to card javascript file, so we can dynamically import and instantiate cards
    abstract importPath: string = '';

    // Keeping references here seems janky, but we need them sooo often. Being able to reverse-lookup which board owns this card is useful consistently
    game: Game;
    ownerBoard: Board;
    opponentBoard: Board;
    controllerBoard: Board;
    oppControllerBoard: Board;

    constructor(owner: number, controller?: number, cardId?: string) {
        this.cardId = cardId ? cardId : Card.makeCardId();
        Card.cardToIdMap.set(this, this.cardId);
        Card.idToCardMap.set(this.cardId, this);

        this.owner = owner;
        this.controller = controller ? controller : owner;
    }

    static makeCardId(): string {
        return anyid()
            .encode('Aa0')
            .length(10)
            .random()
            .id();
    }

    setupGameReferences(game: Game) {
        this.game = game;

        [this.ownerBoard, this.opponentBoard] =
            this.owner == 1 ? [this.game.player1Board, this.game.player2Board] : [this.game.player2Board, this.game.player1Board];

        [this.controllerBoard, this.oppControllerBoard] =
            this.controller == 1 ? [this.game.player1Board, this.game.player2Board] : [this.game.player2Board, this.game.player1Board];
    }

    serialize(): ObjectMap {
        let objMap = {
            constructorName: this.constructor.name,
            importPath: this.importPath,
            techLevel: this.techLevel,
            cardType: this.cardType, // note that some of these things don't need to be saved for server state, but the client uses them so we serialize them
            color: this.color,
            name: this.name,
            flavorType: this.flavorType,
            cardId: this.cardId,
            contains: Card.serializeCards(this.contains),
            owner: this.owner,
            controller: this.controller,
            baseAttributes: Object.assign({}, this.baseAttributes),
            attributeModifiers: Object.assign({}, this.attributeModifiers),
            abilities: Array.from(this.abilityMap.keys()),
            stagingAbilities: Array.from(this.stagingAbilityMap.keys()),
            canUseAbilities: <boolean[]>[],
            canUseStagingAbilities: <boolean[]>[],
            canPlay: this.canPlay(),
            allHealth: this.allHealth,
            allAttack: this.allAttack,
            costAfterAlterations: this.costAfterAlterations
        };

        this.abilityMap.forEach((ability, key, map) => objMap.canUseAbilities.push(ability.canUse()));
        this.stagingAbilityMap.forEach((ability, key, map) => objMap.canUseStagingAbilities.push(ability.canUse()));
        return objMap;
    }

    static serializeCards(cards: Array<Card>): Array<ObjectMap> {
        return cards.map(cardInstance => cardInstance.serialize());
    }

    static deserializeCards(pojoCards: ObjectMap[]): Array<Card> {
        return pojoCards.map(pojoCard => Card.deserialize(pojoCard));
    }

    /** Any state implemented by descendants that isn't readonly should be deserialized in here */
    abstract deserializeExtra(pojo: ObjectMap): void;

    static deserialize(pojo: ObjectMap): Card {
        // Reason #32452345 this project would've been easier in Java. This is a hack-y way of figuring out which specific card we're trying to
        // instantiate, and doing that dynamically. We have to use the Node.js global context to find the class we want, by the name we stored in
        // the POJO, then call new with the relevant arguments.
        let ns: any;
        let card: Card;

        if ((<string>pojo.importPath).length > 0) {
            ns = require(<string>pojo.importPath + '/' + <string>pojo.constructorName + '.js');
            card = new ns[<string>pojo.constructorName](pojo.owner, pojo.controller, pojo.cardId);
        } else {
            ns = module;
            card = new ns['exports'][<string>pojo.constructorName](pojo.owner, pojo.controller, pojo.cardId);
        }

        card.attributeModifiers = <Attributes>pojo.attributeModifiers;

        if (card.attributeModifiers.hasMaestroAbility > 0) Card.setupMaestroAbility(card);

        card.deserializeExtra(pojo);
        return card;
    }

    static maestroAbilityName = 'Maestro: 2 Damage to Building';

    static setupMaestroAbility(card: Card): EventDescriptor {
        let buildingDmgAbility = new DamageAnyBuildingAbility(card, 2);
        buildingDmgAbility.name = Card.maestroAbilityName;
        buildingDmgAbility.requiresExhaust = true;
        card.registerAbility(buildingDmgAbility);
        return new EventDescriptor('Info', card.name + ' can now be exhausted to do 2 damage to any building');
    }

    /**
     * Normal ability.  Use for typical abilities that the user can choose to activate in play.
     *
     * Note that Ability must be registered in the Card constructor.
     *
     * There are three types of abilities:
     *
     *    1) Normal abilities. These show up on the front end when cards are in play or in patrol and ability.canUse()
     *       returns true.  They are listed in card.abilityMap and when the user clicks in the front end on an ability,
     *       the ability action looks up the ability in the map and calls its use() method on the card.
     *
     *    2) Staging abilities.  When a card is played, the game first stages it into the "staging area". It then looks
     *       for staging abilities in card.stagingAbilityMap, and presents them as options for the user to execute BEFORE
     *       the card is played.  For example, Boost is one option.  Another option might be Oathkeeper's choice to do
     *       one thing or another thing, or Murkwood Allies asking you which thing you intend to do.  The game lets the user
     *       choose ONE of the staging abilities in the list, and then moves on.
     *
     *    3) Handler abilities.  These are registered in card.abilityMap() but ability.canUse() always returns false.
     *       Abilities are used to manage the things that would happen from in-game triggers.  For example, if onArrives()
     *       is triggered and the card text asks the user to remove a time rune from a card.  The card with onArrives() registers
     *       a handler ability and uses that ability to prompt the user to select a target, and then resolve the choice.  This whole
     *       flow works just like a normal ability is would, except that ability.canUse() is set to false always, so only the game
     *       can enter this flow via a trigger rather than the user being able to click on a link that causes it.
     */
    registerAbility(ability: Ability) {
        this.abilityMap.set(ability.name, ability);
    }

    unregisterAbility(name: string) {
        this.abilityMap.delete(name);
    }

    /**
     * Staging ability. Use when this ability can only be chosen in the staging area, rather than in play.
     * Note that Ability must be registered in the  Card constructor.
     * @see registerAbility
     */
    registerStagingAbility(ability: Ability) {
        this.stagingAbilityMap.set(ability.name, ability);
        ability.stagingAbility = true;
    }

    /**
     * Handler ability. Use when only the game can trigger this ability, never the user.
     * Note that Ability must be registered in the  Card constructor.
     * @see registerAbility
     */
    registerHandlerAbility(ability: Ability) {
        this.abilityMap.set(ability.name, ability);
        ability.usable = false;
    }

    /**
     * This represents the things that are printed on the card that can actually be changed during the game.
     * This set of attributes won't be changed, but we'll have another set that represent the modifiers.
     * To figure out what's currently in effect, we'll add them together.
     *
     * Note that anything that does stuff "on arrival", like adding tokens on arrival, will not include those
     * as base attributes but will add an OnArrival trigger that adds the tokens to the attribute modifiers below.
     *
     * TODO: Should probably set all of the properties to readonly somewhere, since this only covers the reference
     */
    protected baseAttributes: Attributes = new Attributes();

    /**
     * Modifies the attributes on this card, based on in-play effects and other events.
     * Example:
     * Card comes in w/ Frenzy.  basekeywords['frenzy'] is 1 by default. Drakk is mid-band.
     * We add 1 to statekeywords['frenzy']. Drakk leaves.  We decrement statekeywords['frenzy'].
     * This way we don't have to constantly recaculate the state (e.g. when Drakk leaves, look for anything else that enables Frenzy before we take it off this card),
     * we can just track it on the event occurrence.
     */
    attributeModifiers: Attributes = new Attributes();

    /** This calculates all effective attributes for this card */
    effective(): Attributes {
        let attrSum: Attributes = new Attributes();

        let attr: keyof Attributes;
        for (attr in this.baseAttributes) {
            attrSum[attr] = this.baseAttributes[attr] + this.attributeModifiers[attr];
        }

        return attrSum;
    }

    get allHealth(): number {
        let eff = this.effective();
        return eff.health - eff.minusOneOne + eff.plusOneOne;
    }

    get allAttack(): number {
        let eff = this.effective();
        return eff.attack - eff.minusOneOne + eff.plusOneOne;
    }

    get costAfterAlterations(): number {
        let cost = CardApi.hookOrAlteration(this.game, 'alterCost', [this], 'AllActive').reduce(
            (previousValue: number, currentValue: number, currentIndex: number, array: number[]) => {
                return previousValue + currentValue;
            },
            this.effective().cost
        );
        return cost >= 0 ? cost : 0;
    }

    protected canDoThings(arrivalFatigueOk: boolean, checkAttacksThisTurn: boolean): boolean {
        if (!this.game.cardIsInPlay(this.controllerBoard, this)) {
            return false;
        }

        let attrs = this.effective();

        // can't ever do things when exhausted
        if (attrs.exhausted) return false;

        // check arrival fatigue for attacks and many abilities
        if (!arrivalFatigueOk && attrs.arrivalFatigue && !attrs.haste) return false;

        // check max number of attacks if applicable. check this is a character first, since only characters attack
        if (Reflect.has(this, 'attacksPerTurn') && checkAttacksThisTurn) {
            let character: Character = <Character>(<unknown>this); // typescript requires the unknown cast first when casting 'this'

            if (attrs.haveAttackedThisTurn < character.attacksPerTurn)
                // cards like Rampaging Elephant set this to 2. cards that can't attack set it to 0
                return false;
        }

        return true;
    }

    canPlay(): boolean {
        if (this.costAfterAlterations > this.controllerBoard.gold) return false;

        // to play a hero, max heroes must not be exceeded, and this hero can't have died recently or otherwise been made unavailable
        if (this.cardType == 'Hero') {
            let hero: Hero = <Hero>(<unknown>this);
            if (!this.controllerBoard.heroZone.includes(hero)) return false;

            let heroesInPlay: number = this.game.getAllActiveCards(this.controllerBoard).filter(h => h.cardType == 'Hero').length;
            let maxHeroesInPlay = 1;

            if (this.controllerBoard.techBuildingIsActive(2)) maxHeroesInPlay = 2;
            if (this.controllerBoard.techBuildingIsActive(3)) maxHeroesInPlay = 3;

            let addOn = this.controllerBoard.addOn;
            if (this.controllerBoard.addOn.isActive() && addOn.addOnType == 'Heroes Hall')
                maxHeroesInPlay = maxHeroesInPlay == 3 ? 3 : maxHeroesInPlay + 1;

            return hero.canBeSummoned() && heroesInPlay < maxHeroesInPlay;
        }

        // spells can be played if a hero of the same type is out there, or if we have any hero out there for tech 0 spells
        else if (this.cardType == 'Spell') {
            if (!this.game.cardIsInHand(this.controllerBoard, this)) {
                return false;
            }

            let heroesInPlay: Hero[] = <Hero[]>this.game.getAllActiveCards(this.controllerBoard).filter(h => h.cardType == 'Hero');

            // when no heroes in play, we can't cast spells
            if (heroesInPlay.length === 0) return false;

            // we can always cast tech0. note there's a gold penalty for multi-color decks, but that's already handled
            // by the Spell class in its cost calculation
            if (this.techLevel == 0) {
                return true;
            }

            // for all other spells, the spec must match
            let heroesOfMatchingSpec = heroesInPlay.filter(h => h.spec == this.spec);
            if (heroesOfMatchingSpec.length < 1) return false;

            // finally for ultimate spells, the hero of matching spec must be able to cast them
            let spell: Spell = <Spell>(<unknown>this);
            if (spell.spellLevel == 'Ultimate') return heroesOfMatchingSpec.filter(h => h.canCastUltimate()).length > 0;
            else return true;
        }

        // for all other cards, we just check the tech level
        else {
            if (!this.game.cardIsInHand(this.controllerBoard, this)) {
                return false;
            }

            let techCard: Unit | Spell | Upgrade | Building = <(Unit | Spell | Upgrade | Building)>(<unknown>this);
            if (techCard.techLevel == 0) return true;

            if (!this.controllerBoard.techBuildingIsActive(this.techLevel)) return false;

            if (this.techLevel == 2 || this.techLevel == 3) {
                if (this.controllerBoard.tech2.spec == this.spec) return true;
                else
                    return (
                        this.controllerBoard.addOn.isActive() &&
                        this.controllerBoard.addOn.addOnType == 'Tech Lab' &&
                        this.controllerBoard.addOn.techLabSpec == this.spec
                    );
            }
        }
    }

    canUseAbility(): boolean {
        return this.canDoThings(false, false);
    }

    /** When this card's health is zero, or its damage meets or exceeds its health, return true */
    shouldDestroy(): boolean {
        return this.allHealth <= 0 || this.allHealth <= this.effective().damage;
    }

    /** Resets this card - takes off all tokens, resets all attributes, etc.  Happens when putting back into hand, putting into discard, and so on */
    resetCard(): void {
        this.controller = this.owner;
        this.contains = [];
        this.attributeModifiers = new Attributes();
    }

    isYourCard(otherCard: Card): boolean {
        return otherCard.controller == this.controller;
    }

    isYourCardAndFlavorType(otherCard: Card, flavorType: string): boolean {
        return this.isYourCard(otherCard) && otherCard.flavorType == flavorType;
    }

    /** If otherCard is actually this card, do something */
    doIfThisCard(otherCard: Card, fn: (otherCard: Card) => EventDescriptor): EventDescriptor {
        return otherCard === this ? fn(otherCard) : undefined;
    }

    doIfYourCard(otherCard: Card, fn: (otherCard: Card) => EventDescriptor): EventDescriptor {
        return otherCard.controller == this.controller ? fn(otherCard) : undefined;
    }

    /** When otherCard is controlled by the same player, and its FlavorType matches, run fn(otherCard) */
    doIfYourCardAndFlavorType(otherCard: Card, flavorType: string, fn: (otherCard: Card) => EventDescriptor): EventDescriptor {
        return otherCard.flavorType == this.flavorType ? this.doIfYourCard(otherCard, fn) : undefined;
    }

    /** Gains something like 'haste' or 'frenzy' */
    gainProperty(property: keyof Attributes, numToGain = 1) {
        return this.adjustProperty(numToGain, property);
    }

    /** Loses something like 'haste' or 'frenzy' */
    loseProperty(property: keyof Attributes, numToLose = 1) {
        return this.adjustProperty(-numToLose, property);
    }

    adjustProperties(propNumPairs: [keyof Attributes, number][]): EventDescriptor {
        let description = this.name + ' ';
        let first = true;

        for (let pair of propNumPairs) {
            let [propName, numToChange] = pair;

            let gaining = numToChange > 0;
            let gainWord = gaining ? 'gained' : 'lost';
            let propAdjFn = gaining ? this.gainProperty : this.loseProperty;

            propAdjFn(propName, numToChange);

            if (!first) description += ', ';
            description += gainWord + ' ' + Math.abs(numToChange) + ' ' + propName;
        }

        return new EventDescriptor('PropAdjustment', description);
    }

    private adjustProperty(numToAdjust: number, prop: keyof Attributes) {
        if (!this.game.getAllActiveCards().includes(this)) {
            return new EventDescriptor(
                'NothingHappened',
                this.name + ' ' + prop + ' would have changed, but the card is no longer in play'
            );
        }

        let add = numToAdjust > 0;

        if (add) this.attributeModifiers[prop] += numToAdjust;
        else this.attributeModifiers[prop] -= numToAdjust;

        let desc: string = (add ? ' gained ' : ' removed ') + numToAdjust + ' ' + prop;

        return new EventDescriptor('PropAdjustment', this.name + desc, {
            cardId: this.cardId,
            gained: add,
            numChanged: numToAdjust
        });
    }
}

// TODO
export abstract class Upgrade extends Card {
    readonly cardType: CardType = 'Upgrade';
    deserializeExtra(pojo: ObjectMap): void {}
}

// TODO
export abstract class Building extends Card {
    readonly cardType: CardType = 'Building';
    deserializeExtra(pojo: ObjectMap): void {}
}

/** Base class for heroes and units */
export abstract class Character extends Card {
    attacksPerTurn: number = 1;

    serialize(): ObjectMap {
        let pojo = super.serialize();
        pojo.attacksPerTurn = this.attacksPerTurn;
        pojo.canAttack = this.canAttack();
        pojo.canPatrol = this.canPatrol();
        pojo.canSideline = this.canSideline();
        return pojo;
    }

    deserializeExtra(pojo: ObjectMap) {
        this.attacksPerTurn = <number>pojo.attacksPerTurn; // in case this can be modified by cards
    }

    canAttack(): boolean {
        if (this.effective().cantAttack > 0) return false;
        else return this.canDoThings(false, true);
    }

    canPatrol(): boolean {
        if (this.effective().cantPatrol > 0) return false;
        if (this.controllerBoard.getPatrolZoneAsArray().length == 5) return false;
        else return this.canDoThings(true, false);
    }

    canSideline(): boolean {
        return this.controllerBoard.getPatrolZoneAsArray().includes(this);
    }
}

export abstract class Unit extends Character {
    readonly isToken: boolean = false;

    readonly cardType: CardType = 'Unit';

    serialize(): ObjectMap {
        let pojo = super.serialize();
        pojo.isToken = this.isToken;
        return pojo;
    }

    deserializeExtra(pojo: ObjectMap): void {}
}

/**
 * Tracking what's on the card.  We get the final number by adding up what's here and what the card's base statistics are.  This is a little inefficient because the card doesn't have
 * base stats for everything, so it might make more sense to create two objects and create some sort of union, but this makes life easy.
 */
export class Attributes {
    // Cost in gold
    cost: number = 0;

    // Basic health and attack, before runes etc
    health: number = 0;
    attack: number = 0;

    // Base armor, before modifiers etc
    armor: number = 0;
    damage: number = 0;
    damageToArmor: number = 0;

    // Deals damage as -1/-1 runes
    dealsDamageAsMinus11: number = 0;

    // Counting how many runes are on the card
    plusOneOne: number = 0;
    minusOneOne: number = 0;
    timeRunes: number = 0;
    featherRunes: number = 0;
    crumblingRunes: number = 0;

    // The number of things this will obliterate on attack
    obliterate: number = 0;

    // From here on down are counters - the number of times this keyword is effective on this card
    swiftStrike: number = 0;
    frenzy: number = 0;
    stealth: number = 0;
    flying: number = 0;
    antiAir: number = 0;
    longRange: number = 0;
    unstoppable: number = 0;
    invisible: number = 0;
    overpower: number = 0;
    readiness: number = 0;
    haste: number = 0;
    unattackable: number = 0;
    detector: number = 0;
    untargetable: number = 0;
    ephemeral: number = 0;
    resist: number = 0;
    healing: number = 0;
    sparkshot: number = 0;
    flagbearer: number = 0;

    // Things can go in and out of illusion mode, so we track like an attribute.  diesWhenTargeted can change
    // when Macchiatus comes into play
    illusion: number = 0;
    diesWhenTargeted: number = 0;

    // Tracking tower ability
    towerRevealedThisTurn: number = 0;

    // Some cards say "cant sacrifice", "cant patrol", etc.  Track those here
    cantSacrifice: number = 0;
    cantPatrol: number = 0;
    cantAttack: number = 0;

    /** After a card is used in a way that exhausts it.
     * These cards can't use most abilities and can't patrol.
     * Add 1 to this every time something is disabled, and we'll remove the counters as we go. */
    exhausted: number = 0;

    /** For cards that just arrived. These cards can't do anything that
     * requires exhausting, but can patrol. */
    arrivalFatigue: number = 0;

    /** This is for cards w/ readiness, to track if they've already attacked once this turn. */
    haveAttackedThisTurn: 0;

    /** These are for temporary abilities that were added by other cards, tracking that the ability was added */
    hasMaestroAbility: 0;

    // TODO: Also model temporaryArmor / temporaryAttack.  See: Aged Sensei.  He'll have to add a trigger to clear it by end of turn.
    // TODO: For Safe Attacking - maybe there's a startOfAttack trigger and an endOfAttack trigger to add / remove the armor?
}

export abstract class Hero extends Character {
    readonly cardType: CardType = 'Hero';

    abstract readonly midLevel: number;
    abstract readonly maxLevel: number;

    abstract readonly healthMinMidMax: number[];
    abstract readonly attackMinMidMax: number[];

    castsUltimateImmediately: boolean = false; // some heroes may set this to true, e.g. Prynn

    private _level: number = 1;
    private turnsTilAvailable: number = 0;
    private turnsTilCastUltimate: number = 1;

    serialize(): ObjectMap {
        let pojo = super.serialize();
        pojo.level = this.level;
        pojo.midLevel = this.midLevel;
        pojo.maxLevel = this.maxLevel;
        pojo.turnsTilAvailable = this.turnsTilAvailable;
        pojo.turnsTilCastUltimate = this.turnsTilCastUltimate;
        return pojo;
    }

    deserializeExtra(pojo: ObjectMap): void {
        this._level = <number>pojo.level;
        this.turnsTilAvailable = <number>pojo.turnsTilAvailable;
        this.turnsTilCastUltimate = <number>pojo.turnsTilCastUltimate;
    }

    canCastUltimate(): boolean {
        return this.level == this.maxLevel && this.turnsTilCastUltimate === 0;
    }

    canBeSummoned() {
        return this.turnsTilAvailable === 0;
    }

    markCantBeSummonedNextTurn() {
        this.turnsTilAvailable = 2;
    }

    get level() {
        return this._level;
    }

    set level(newLvl: number) {
        if (newLvl > this.maxLevel) newLvl = this.maxLevel;
        else if (newLvl < 1) newLvl = 1;

        if (newLvl > this._level) {
            let hittingMid = false,
                hittingMax = false;

            hittingMid = this._level < this.midLevel && newLvl >= this.midLevel;
            hittingMax = this._level < this.maxLevel && newLvl == this.maxLevel;

            this._level = newLvl;

            if (hittingMid || hittingMax) {
                this.healAllDamage();
            }

            if (hittingMid) {
                CardApi.hookOrAlteration(this.game, 'heroMid', [], 'None', this);
                this.baseAttributes.health = this.healthMinMidMax[1];
                this.baseAttributes.attack = this.attackMinMidMax[1];
            }
            if (hittingMax) {
                CardApi.hookOrAlteration(this.game, 'heroMax', [], 'None', this);
                this.baseAttributes.health = this.healthMinMidMax[2];
                this.baseAttributes.attack = this.attackMinMidMax[2];
            }

            if (hittingMax) this.game.addEvent(new EventDescriptor('HeroMax', this.name + ' is now max-band (level ' + newLvl + ')'));
            else if (hittingMid) this.game.addEvent(new EventDescriptor('HeroMid', this.name + ' is now mid-band  (level ' + newLvl + ')'));
            else this.game.addEvent(new EventDescriptor('HeroGainLvl', this.name + ' is now level ' + newLvl));
        } else if (newLvl < this._level) {
            let losingMid = this._level >= this.midLevel && newLvl < this.midLevel;
            let losingMax = this._level >= this.maxLevel && newLvl < this.maxLevel;

            this._level = newLvl;

            if (losingMax) {
                CardApi.hookOrAlteration(this.game, 'heroLoseMax', [], 'None', this);
                this.baseAttributes.health = this.healthMinMidMax[1];
                this.baseAttributes.attack = this.attackMinMidMax[1];
            }
            if (losingMid) {
                CardApi.hookOrAlteration(this.game, 'heroLoseMid', [], 'None', this);
                this.baseAttributes.health = this.healthMinMidMax[0];
                this.baseAttributes.attack = this.attackMinMidMax[0];
            }

            this.game.addEvent(new EventDescriptor('HeroDrain', this.name + ' is now level ' + newLvl));
        }

        if (this._level === this.maxLevel) this.turnsTilCastUltimate = this.castsUltimateImmediately ? 0 : 1;
    }

    healAllDamage() {
        let damage = this.effective().damage;
        if (damage > 0) this.loseProperty('damage', damage);
    }

    newTurn() {
        if (this.turnsTilAvailable > 0) this.turnsTilAvailable--;
        if (this.level == this.maxLevel && this.turnsTilCastUltimate > 0) this.turnsTilCastUltimate--;
    }

    /** Note that for heroes, this makes them available immediately */
    resetCard() {
        super.resetCard();
        this.turnsTilAvailable = 0;
        this.turnsTilCastUltimate = this.castsUltimateImmediately ? 0 : 1;
        this.level = 1;
    }
}

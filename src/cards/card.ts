
import { anyid } from 'anyid';
import { Game, EventDescriptor, RuneEvent } from '../game';
import { ObjectMap } from '../game_server';
import { Board } from '../board';
import * as Color from './color';

export type CardType = "Spell" | "Hero" | "Unit" | "Building" | "Upgrade" | "Effect" | "None";
export type TechLevel = "Tech 0" | "Tech 1" | "Tech 2" | "Tech 3";
export type SpellLevel = "Tech 0" | "Normal" | "Ultimate"; 
export type SpellType = "Burn" | "Buff" | "Debuff";
export type FlavorType = "Effect" | "QA" | "Mercenary" | "Virtuoso" | "Drunkard" | "Cute Animal" | "Flagbearer" | "Ninja" | "Lizardman" | "Beast";

export abstract class Card {

    readonly abstract cardType: CardType;
    
    readonly abstract techLevel: TechLevel;
    readonly abstract color: Color.ColorName;
    readonly abstract spec: Color.Spec;
    
    readonly abstract name: string;
    readonly abstract flavorType: FlavorType;

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
    oppositionalControllerBoard: Board;

    constructor(game: Game, owner: number, controller?: number, cardId?: string) {
        this.cardId = cardId ? cardId : anyid().encode('Aa0').length(10).random().id();
        Card.cardToIdMap.set(this, this.cardId);
        Card.idToCardMap.set(this.cardId, this);

        this.game = game;

        this.owner = owner;
        this.controller = this.controller ? this.controller : this.owner;

        if (this.owner === 1) {
            this.ownerBoard = this.game.player1Board;
            this.opponentBoard = this.game.player2Board;
        }
        else {
            this.ownerBoard = this.game.player2Board;
            this.opponentBoard = this.game.player1Board;
        }

        if (this.controller === 1) {
            this.controllerBoard = this.game.player1Board;
            this.oppositionalControllerBoard = this.game.player2Board
        }
        else {
            this.controllerBoard = this.game.player2Board;
            this.oppositionalControllerBoard = this.game.player1Board;
        }
    }

    serialize(): ObjectMap {
        return {
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
            canUseAbility: this.canUseAbility(),
            canPlay: this.canPlay()
        };
    }

    static serializeCards(cards: Array<Card>): Array<ObjectMap> {
        return cards.map(cardInstance => cardInstance.serialize());
    }

    static deserializeCards(pojoCards: ObjectMap[], game: Game): Array<Card> {
        return pojoCards.map(pojoCard => Card.deserialize(pojoCard, game));
    }

    /** Any state implemented by descendants that isn't readonly should be deserialized in here */
    abstract deserializeExtra(pojo: ObjectMap): void;

    static deserialize(pojo: ObjectMap, game: Game): Card {
        // Reason #32452345 this project would've been easier in Java. This is a hack-y way of figuring out which specific card we're trying to
        // instantiate, and doing that dynamically. We have to use the Node.js global context to find the class we want, by the name we stored in 
        // the POJO, then call new with the relevant arguments.
        let ns: any;
        let card: Card;

        if ((<string>pojo.importPath).length > 0) {
            ns = require(<string>pojo.importPath + '/' + <string>pojo.constructorName + '.js'); 
            card = new ns[<string>pojo.constructorName](game, pojo.owner, pojo.controller, pojo.cardId);
        }
        else {
            ns = module;
            card = new ns['exports'][<string>pojo.constructorName](game, pojo.owner, pojo.controller, pojo.cardId);
        }

        card.deserializeExtra(pojo);
        return card;
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

    protected canDoThings(arrivalFatigueOk: boolean, checkAttacksThisTurn: boolean): boolean {
        if (!this.game.cardIsInPlay(this.controllerBoard, this)) {
            return false;
        }
    
        let attrs = this.effective();

        // can't ever do things when exhausted
        if (attrs.exhausted)
            return false;

        // check arrival fatigue for attacks and many abilities
        if (!arrivalFatigueOk && attrs.arrivalFatigue)
            return false;
    
        // check max number of attacks if applicable. check this is a character first, since only characters attack
        if (Reflect.has(this, 'attacksPerTurn') && checkAttacksThisTurn) {
            let character: Character = <Character><unknown>this; // typescript requires the unknown cast first when casting 'this'
            
            if (attrs.haveAttackedThisTurn < character.attacksPerTurn) // cards like Rampaging Elephant set this to 2. cards that can't attack set it to 0
                return false;
        }

        return true;
    }

    canPlay(): boolean {
        if (!this.game.cardIsInHand(this.controllerBoard, this)) {
            return false;
        }

        let attrs = this.effective(); // get effective gold cost, since many things may modify it

        if (attrs.cost > this.controllerBoard.gold)
            return false;
        
        // to play a hero, max heroes must not be exceeded, and this hero can't have died recently or otherwise been made unavailable
        if (this.cardType == 'Hero') {
            let hero: Hero = <Hero><unknown>this;

            let heroesInPlay: number = this.game.getAllActiveCards(this.controllerBoard).filter(h => h.cardType == 'Hero').length;
            let maxHeroesInPlay = 1;
            
            if (this.controllerBoard.techBuildingIsActive('Tech 2'))
                maxHeroesInPlay = 2;
            if (this.controllerBoard.techBuildingIsActive('Tech 3'))
                maxHeroesInPlay = 3;
            
            let addOn = this.controllerBoard.addOn;
            if (addOn && addOn.addOnType == 'Heroes Hall' && !addOn.constructionInProgress)
                maxHeroesInPlay = (maxHeroesInPlay == 3) ? 3 : maxHeroesInPlay + 1;

            return hero.turnsTilAvailable === 0 && heroesInPlay < maxHeroesInPlay;
        }

        // spells can be played if a hero of the same type is out there, or if we have any hero out there for tech 0 spells
        else if (this.cardType == 'Spell') {
            let heroesInPlay: Hero[] = <Hero[]>this.game.getAllActiveCards(this.controllerBoard).filter(h => (h.cardType == 'Hero'));

            // when no heroes in play, we can't cast spells
            if (heroesInPlay.length === 0)
                return false;

            // we can always cast tech0. note there's a gold penalty for multi-color decks, but that's already handled
            // by the Spell class in its cost calculation
            if (this.techLevel == 'Tech 0') {
                return true;
            }

            // for all other spells, the spec must match
            let heroesOfMatchingSpec = heroesInPlay.filter(h => (h.spec == this.spec));
            if (heroesOfMatchingSpec.length < 1)
                return false;

            // finally for ultimate spells, the hero of matching spec must be able to cast them
            let spell: Spell = <Spell><unknown>this;
            if (spell.spellLevel == 'Ultimate')
                return (heroesOfMatchingSpec.filter(h => h.canCastUltimate()).length > 0);
            else
                return true;
        }

        // for all other cards, we just check the tech level
        else {
            if (this.techLevel == 'Tech 0')
                return true;

            if (!this.controllerBoard.techBuildingIsActive(this.techLevel))
                return false;

            if (this.techLevel == 'Tech 2' || this.techLevel == 'Tech 3') {
                if (this.controllerBoard.tech2.spec == this.spec)
                    return true;
                else return (this.controllerBoard.addOnIsActive() && this.controllerBoard.addOn.addOnType == 'Tech Lab' 
                        && this.controllerBoard.addOn.techLabSpec == this.spec)
            }
        }
    }

    canUseAbility(): boolean {
        return this.canDoThings(false, false);
    }

    /** When this card's health is zero, or its damage meets or exceeds its health, return true */
    shouldDestroy(): boolean {
        let attributes: Attributes = this.effective();
        return (attributes.health <= 0 || attributes.health <= attributes.damage)
    }

    /** Resets this card - takes off all tokens, resets all attributes, etc.  Happens when putting back into hand, putting into discard, and so on */
    resetCard(): void {
        this.controller = this.owner;
        this.contains = [];
        this.attributeModifiers = new Attributes();
    }

    /** If otherCard is actually this card, do something */
    doIfThisCard(otherCard: Card, fn: (otherCard: Card) => EventDescriptor): EventDescriptor {
        return (otherCard === this) ? fn(otherCard) : undefined;
    }

    /** When otherCard is controlled by the same player, and its FlavorType matches, run fn(otherCard) */
    doIfYourCardAndFlavorType(otherCard: Card, flavorType: FlavorType, fn: (otherCard: Card) => EventDescriptor): EventDescriptor {
        if (otherCard.controller === this.controller && otherCard.flavorType && otherCard.flavorType === flavorType)
            return fn(otherCard);
        else
            return undefined;
    }

    /** Gains something like 'haste' or 'frenzy' */
    gainProperty(property: keyof Attributes, numToGain = 1) {
        return this.adjustProperty(numToGain, property, 'add');
    }

    /** Loses something like 'haste' or 'frenzy' */
    loseProperty(property: keyof Attributes,  numToLose = 1) {
        return this.adjustProperty(numToLose, property, 'subtract');
    }

    private adjustProperty(numToAdjust: number, runeProperty: keyof Attributes, addOrSubtract: ('add' | 'subtract')) {
        let add = addOrSubtract == 'add';

        if (add)
            this.attributeModifiers[runeProperty] += numToAdjust;
        else 
            this.attributeModifiers[runeProperty] -= numToAdjust;

        let desc: string = (add ? ' gained ' : ' removed ') + numToAdjust + " " + runeProperty;

        return new EventDescriptor(<RuneEvent>runeProperty, this.name + desc, { cardId: this.cardId, gained: add, numChanged: numToAdjust });
    }
}

export abstract class Spell extends Card {
    readonly cardType: CardType = "Spell";
    
    readonly abstract spellLevel: SpellLevel;
    
    serialize(): ObjectMap {
        let pojo = super.serialize();
        pojo.spellLevel = this.spellLevel;
        return pojo;
    }

    deserializeExtra(pojo: ObjectMap): void {}

    effective(): Attributes {
        let attrs = super.effective();

        if (!this.controllerBoard.multiColor || !(this.techLevel == 'Tech 0'))
            return attrs;

        // we only have Tech 0 spells for our chosen starting color, and if we're multi-color,
        // casting them with a different colored hero costs 1 extra gold
        let sameColorHeroes = this.game.getAllActiveCards(this.controllerBoard).filter(h => (h.cardType == 'Hero' && (h.color == this.color)));

        if (sameColorHeroes.length === 0)
            attrs.cost++;
        
        return attrs;
    }
}

// TODO
export abstract class Upgrade extends Card {
    readonly cardType: CardType = "Upgrade";
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
        return pojo;
    }

    deserializeExtra(pojo: ObjectMap) {
        this.attacksPerTurn = <number>pojo.attacksPerTurn; // in case this can be modified by cards
    }

    canAttack(): boolean {
        return this.canDoThings(false, true);
    }

    canPatrol(): boolean {
        return this.canDoThings(true, false);
    }
}

export abstract class Unit extends Character {
    readonly isToken: boolean = false;

    readonly cardType: CardType = "Unit";

    serialize(): ObjectMap {
        let pojo = super.serialize();
        pojo.isToken = this.isToken;
        return pojo;
    }

    deserializeExtra(pojo: ObjectMap): void {}
}

export abstract class Hero extends Character {
    readonly cardType: CardType = "Hero";

    level: number = 1;

    readonly abstract midLevel: number;
    readonly abstract maxLevel: number;

    turnsTilAvailable: number = 0;
    turnsTilCastUltimate: number = 1; // some heroes may set this to 0, e.g. Prynn

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
        this.level = <number>pojo.level;
        this.turnsTilAvailable = <number>pojo.turnsTilAvailable;
        this.turnsTilCastUltimate = <number>pojo.turnsTilCastUltimate;
    }

    canCastUltimate(): boolean {
        return this.level == this.maxLevel && this.turnsTilCastUltimate === 0;
    }

    markCantBeSummonedNextTurn() {
        this.turnsTilAvailable = 2;
    }

    /** Note that for heroes, this makes them available immediately */
    resetCard() {
        super.resetCard();
        this.turnsTilAvailable = 0;
        this.level = 1;
    }
}

/**  
 * Tracking what's on the card.  We get the final number by adding up what's here and what the card's base statistics are.  This is a little inefficient because the card doesn't have
 * base stats for everything, so it might make more sense to create two objects and create some sort of union, but this makes life easy.
 */
export class Attributes {
    // Cost in gold
    cost: number = 0;

    // Sum total effective attack and health
    private _health: number = 0; 
    private _attack: number = 0;

    // Effective armor, not including squad leader. Some things come with armor or can have armor added
    private _armor: number = 0;

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

    // Counting how many runes are on the card
    timeRunes: number = 0;
    damage: number = 0;
    plusOneOne: number = 0;
    minusOneOne: number = 0;
    featherRunes: number = 0;
    crumblingRunes: number = 0;

    /** After a card is used in a way that exhausts it. 
     * These cards can't use most abilities and can't patrol.
     * Add 1 to this every time something is disabled, and we'll remove the counters as we go. */
    exhausted: number = 0;

    /** For cards that just arrived. These cards can't do anything that
     * requires exhausting, but can patrol. */
    arrivalFatigue: number = 0;

    /** This is for cards w/ readiness, to track if they've already attacked once this turn. */
    haveAttackedThisTurn: 0;

    /** Whenever we discover a card that requires getters/setters, we can implement as needed. 
     * Fortunately Javascript makes the property access syntax of thing.health the same whether it's a method accessor or simple property,
     * so no refactoring is needed elsewhere to make this switch even if we're iterating through property names or whatever. */
    
    get health(): number { 
        return this.calcPostTokenHpOrAtk(this._health);
    }
    set health(newHealth: number) {
        this._health = newHealth;
    }

    get attack(): number {
        return this.calcPostTokenHpOrAtk(this._attack);
    }
    set attack(newAttack: number) {
        this._attack = newAttack;
    }

    private calcPostTokenHpOrAtk(hpOrAtk: number) {
        return hpOrAtk - this.minusOneOne + this.plusOneOne;
    }

    // TODO: Also model temporaryArmor / temporaryAttack.  See: Aged Sensei.  He'll have to add a trigger to clear it by end of turn.
    // TODO: For Safe Attacking - maybe there's a startOfAttack trigger and an endOfAttack trigger to add / remove the armor? 
}

export interface AttacksHandler extends Card {
    onAttack(attacker: Card, defender: Card): EventDescriptor;
}

export interface UpkeepHandler extends Card {
    onUpkeep(): EventDescriptor;
}

/** Called when ANY card arrives, including this card */
export interface ArrivesHandler extends Card {
    onArrives(arrivingCard: Card): EventDescriptor;
}

/** For cards like Abomination or Nimble Fencer, they modify card status all the time, according to some selection criteria (eg Fencer modifies Virtuosos) */
export interface GlobalBonusHook extends Card {
    giveBonus(card: Card): EventDescriptor; // call this to give the bonus to a card; usually called when this arrives or something else arrives
    removeBonus(card: Card): EventDescriptor; // when card dies, use this to remove the bonus we applied earlier
}

/** When a card is about to die, this can trigger to do something (e.g. save it) */
export interface WouldDieHook extends Card {
    wouldDie(cardToDie: Card): EventDescriptor;
}

/** Called when ANY card dies, including this card */
export interface DiesHandler extends Card {
    onDies(dyingCard: Card): EventDescriptor;
}

/** Called when ANY card would be discarded, including this card */
export interface WouldDiscardHook extends Card {
    wouldDiscard(cardToDiscard: Card): EventDescriptor;
}

/** Called when ANY card leaves play, including this card */
export interface LeavesHandler extends Card {
    onLeaves(leavingCard: Card): EventDescriptor;
}

/** Called when ANY card attacks, including this card */
export interface AttacksHandler extends Card {
    onAttacks(attackingCard: Card): EventDescriptor;
}

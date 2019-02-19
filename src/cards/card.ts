
import {anyid} from 'anyid';

export abstract class Card {

    readonly abstract cardType: CardType;
    readonly abstract color: Color;
    
    readonly abstract name: string;

    // We need some way to identify active cards.  Note that we re-generate card objects when they are discarded
    readonly cardId: string;

    /** Some cards, like Jail or Graveyard, are containers for other cards */
    contains: Array<Card>;

    static cardToIdMap: Map<Card, string>;
    static idToCardMap: Map<string, Card>;

    constructor() {
        this.cardId = anyid().encode('Aa0').length(10).random().id();
        Card.cardToIdMap.set(this, this.cardId);
        Card.idToCardMap.set(this.cardId, this);
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

    /** Resets this card - takes off all tokens, resets all attributes, etc.  Happens when putting back into hand, putting into discard, and so on */
    leavePlay(): void {
        this.attributeModifiers = new Attributes();
    }
}

// TODO
export abstract class Spell extends Card {
    cardType: CardType = "Spell";
}

// TODO
export abstract class Upgrade extends Card {
    cardType: CardType = "Upgrade";
}

// TODO
export abstract class Building extends Card {}

/** Base class for heroes and units */
export abstract class Character extends Card {}

export abstract class Unit extends Character {
    abstract techLevel: TechLevel;
    abstract flavorType: FlavorType;

    cardType: CardType = "Unit";
}

// TODO
export abstract class Hero extends Character {
    abstract level: number;
    cardType: CardType = "Hero";
    justDied: boolean = false;
}

/** 
 * Sometimes an ability or spell will affect the game for a period of time.  The effect is best represented by a typical handler,
 * but where does the handler go if the card leaves play?  For example, spells leave play as soon as you cast them, and ability effects
 * may last beyond the death of the card that enacted them.
 * 
 * To account for this, we create a "card" called an Effect that the user can't see but the game can track.  This special card tracks the
 * impact of ongoing effects and can setup handlers as if it was a card to do things at specific times, destroy itself at a specific time, etc.
 * 
 * Making this a "card" means the game can search all cards for, say, OnUpkeep handlers and do them, and the engine doesn't need to know or care
 * what's making those handlers happen.
 */
export class Effect extends Card {
    readonly cardType: 'None';
    readonly color: 'None';
    readonly name: 'Effect';
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

export type CardType = "Spell" | "Hero" | "Unit" | "Building" | "Upgrade" | "None";
export type Color = "Neutral" | "Red" | "Green" | "Black" | "White" | "Purple" | "Blue" | "None";
export type TechLevel = "Tech 0" | "Tech 1" | "Tech 2" | "Tech 3";
export type SpellType = "Burn" | "Buff" | "Debuff";
export type FlavorType = "Mercenary" | "Virtuoso" | "Drunkard" | "Cute Animal" | "Flagbearer" | "Ninja" | "Lizardman";
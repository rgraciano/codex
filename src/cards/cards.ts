// some interesting cards to model:
//     Rememberer, Abomination, Building Inspector, any of the illusions
//     How do we handle Heroes?  Separate class?  They do a lot of the same things...


// we will need a way to disambiguate the cards, so we can target specific cards. 
// maybe we number them in play, or create an identifier based on where they sit.
abstract class Card {

    readonly abstract cardType: CardType;
    readonly abstract color: Color;
    
    readonly abstract name: string;

    /** 
     * This represents the things that are printed on the card that can actually be changed during the game. 
     * This set of attributes won't be changed, but we'll have another set that represent the modifiers.
     * To figure out what's currently in effect, we'll add them together.
     * 
     * Note that anything that does stuff "on arrival", like adding tokens on arrival, will not include those
     * as base attributes but will add an OnArrival trigger that adds the tokens to the attribute modifiers below.
     */
    readonly abstract baseAttributes: Attributes;
    
    /** 
     * Modifies the attributes on this card, based on in-play effects and other events.
     * Example: 
     * Card comes in w/ Frenzy.  basekeywords['frenzy'] is 1 by default. Drakk is mid-band.  
     * We add 1 to statekeywords['frenzy']. Drakk leaves.  We decrement statekeywords['frenzy'].  
     * This way we don't have to constantly recaculate the state (e.g. when Drakk leaves, look for anything else that enables Frenzy before we take it off this card), 
     * we can just track it on the event occurrence.
     */
    public attributeModifiers: Attributes;

    /** This calculates all effective attributes for this card */
    effective(): Attributes {
        let attrSum: Attributes = new Attributes();

        let attr: keyof Attributes;
        for (attr in this.baseAttributes) {
            attrSum[attr] = this.baseAttributes[attr] + this.attributeModifiers[attr];

            // Note we don't check damage here, or armor, or frenzy, as we'll check those at the appropriate times.
            if (attr == "health" || attr == "attack") {
                attrSum[attr] -= this.attributeModifiers.minusOneOne;
                attrSum[attr] += this.baseAttributes[attr] + this.attributeModifiers.plusOneOne;
            }
        }

        return attrSum;
    }
}

abstract class Spell extends Card {
    cardType: CardType = "Spell";
}

abstract class Upgrade extends Card {
    cardType: CardType = "Upgrade";
}

abstract class Building extends Card {}

/** Base class for heroes and units */
abstract class Character extends Card {}

abstract class Unit extends Character {
    abstract techLevel: TechLevel;
    abstract flavorType: FlavorType;

    cardType: CardType = "Unit";
}

abstract class Hero extends Character {
    abstract level: number;
    cardType: CardType = "Hero";
    justDied: boolean = false;
}


/**  Tracking what's on the card */
class Attributes {
    // Cost in gold
    public cost: number = 0;

    // Sum total effective attack and health
    public health: number = 0; 
    public attack: number = 0;

    // Effective armor, not including squad leader. Some things come with armor or can have armor added
    public armor: number = 0;

    // The number of things this will obliterate on attack
    public obliterate: number = 0; 
   
    // From here on down are counters - the number of times this keyword is effective on this card
    public swiftStrike: number = 0; 
    public frenzy: number = 0;
    public stealth: number = 0;
    public flying: number = 0;
    public antiAir: number = 0;
    public longRange: number = 0;
    public unstoppable: number = 0;
    public invisible: number = 0;
    public overpower: number = 0;
    public readiness: number = 0;
    public haste: number = 0;

    // Counting how many runes are on the card
    public timeRunes: number = 0;
    public damage: number = 0;
    public plusOneOne: number = 0;
    public minusOneOne: number = 0;
    public featherRunes: number = 0;
    public crumblingRunes: number = 0;
}

type CardType = "Spell" | "Hero" | "Unit" | "Building" | "Upgrade";
type Color = "Neutral" | "Red" | "Green" | "Black" | "White" | "Purple" | "Blue";
type TechLevel = "Tech 0" | "Tech 1" | "Tech 2" | "Tech 3";
type SpellType = "Burn" | "Buff" | "Debuff";
type FlavorType = "Mercenary" | "Virtuoso" | "Drunkard" | "Cute Animal" | "Flagbearer" | "Ninja" | "Lizardman";

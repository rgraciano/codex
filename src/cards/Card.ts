// some interesting cards to model:
//     Rememberer, Abomination, Building Inspector, any of the illusions
//     How do we handle Heroes?  Separate class?  They do a lot of the same things...


// should use an interface defining basehealth etc... this is so ugly without constants, groupings
// we will need a way to disambiguate the cards, so we can target specific cards. maybe we number them in play
class Card {

    // for a list of cards, will get you a string representing the names.
    // this doesn't seem like the right place to put this in JS. TODO find out where util functions should go & how to group
    static cardNamesString(cards: Array<Card>) { 
        let cardNameStr = "";
        for (let card of cards) {
            if (cardNameStr == "")
                cardNameStr = card.type;
            else
                cardNameStr += ", " + card.type;
        }

        return cardNameStr;
    }
}

class Spell extends Card {

    
    constructor() {
        super();

    }
}

/** Base class for heroes and units */
class Character extends Card {
    
    /** This is what the card starts with.  Should never be changed */
    protected baseKeywords: Keywords;
    
    /** Adds & removes keywords from this card, based on in-play effects and other events.
     * Example: 
     * Card comes in w/ Frenzy.  basekeywords['frenzy'] is 1 by default. Drakk is mid-band.  
     * We add 1 to statekeywords['frenzy']. Drakk leaves.  We decrement statekeywords['frenzy'].  
     * This way we don't have to constantly recaculate the state (e.g. when Drakk leaves, look for anything else that enables Frenzy before we take it off this card), 
     * we can just track it on the event occurrence.
     */
    public stateKeywords: Keywords;

    keywords(): Keywords {
        var keywordUnion = new Keywords();

        for (let kwd in this.baseKeywords) {
            keywordUnion[kwd] = this.baseKeywords[kwd] + this.stateKeywords[kwd];
        }

        return keywordUnion;
    }
}

class Unit extends Character {

}

class Hero extends Character {

}

class Metacard {
    const 
}

/** These are all keywords that always work the same way.  E.g., frenzy is always frenzy, whereas "arrives" or "obliterate" come with additional information */
class Keywords {
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
    public obliterate: number = 0; // obliterate works a bit differently, in that we'll count the number of things to obliterate rather than just keyword instances. This is hacky and I'll regret it later..
    public haste: number = 0;
}


enum CardTypes {
    Spell = "Spell",
    Hero = "Hero",
    Unit = "Unit",
    Building = "Building",
    Upgrade = "Upgrade"
}
enum Colors {
    Neutral = "Neutral",
    Red = "Red",
    Green = "Green",
    Black = "Black",
    White = "White",
    Purple = "Purple",
    Blue = "Blue"
}
enum TechLevels {
    Tech0 = "Tech 0",
    Tech1 = "Tech 1",
    Tech2 = "Tech 2",
    Tech3 = "Tech 3"
}
enum SpellTypes {
    Burn = "Burn",
    Buff = "Buff",
    Debuff = "Debuff",

}
// Note this could be done with inheritance... but we can add types to things, and copy types, so I'm going to initially model with enums
enum FlavorTypes {
    Mercenary = "Mercenary",
    Virtuoso = "Virtuoso",
    Drunkard = "Drunkard",
    CuteAnimal = "Cute Animal",
    Flagbearer = "Flagbearer",
    Ninja = "Ninja",
    Lizardman = "Lizardman" 
    // more to do..
}
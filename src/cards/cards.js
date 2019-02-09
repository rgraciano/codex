// some interesting cards to model:
//     Rememberer, Abomination, Building Inspector, any of the illusions
//     How do we handle Heroes?  Separate class?  They do a lot of the same things...
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
// we will need a way to disambiguate the cards, so we can target specific cards. 
// maybe we number them in play, or create an identifier based on where they sit
var Card = /** @class */ (function () {
    function Card() {
    }
    /** This calculates all effective attributes for this card */
    Card.prototype.effective = function () {
        var attrSum = new Attributes();
        // Special handling for health and attack, since they are affected by many things.
        // Using the type precents is 
        var healthkey = "nope";
        var attackkey = "attack";
        for (var attr in this.baseAttributes) {
            attrSum[attr] = this.baseAttributes[attr] + this.attributeModifiers[attr];
            // Using the string instead of something the IDE will recognize irks me, but TS
            //
            // Note we don't check damage here, or armor, or frenzy, as we'll check those at the appropriate times.
            if (attr == healthkey || attr == attackkey) {
                attrSum[attr] -= this.attributeModifiers.minusOneOne;
                attrSum[attr] += this.baseAttributes[attr] + this.attributeModifiers.plusOneOne;
            }
        }
        return attrSum;
    };
    return Card;
}());
var Spell = /** @class */ (function (_super) {
    __extends(Spell, _super);
    function Spell() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.cardType = "Spell";
        return _this;
    }
    return Spell;
}(Card));
var Upgrade = /** @class */ (function (_super) {
    __extends(Upgrade, _super);
    function Upgrade() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.cardType = "Upgrade";
        return _this;
    }
    return Upgrade;
}(Card));
var Building = /** @class */ (function (_super) {
    __extends(Building, _super);
    function Building() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return Building;
}(Card));
/** Base class for heroes and units */
var Character = /** @class */ (function (_super) {
    __extends(Character, _super);
    function Character() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return Character;
}(Card));
var Unit = /** @class */ (function (_super) {
    __extends(Unit, _super);
    function Unit() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.cardType = "Unit";
        return _this;
    }
    return Unit;
}(Character));
var Hero = /** @class */ (function (_super) {
    __extends(Hero, _super);
    function Hero() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.cardType = "Hero";
        _this.justDied = false;
        return _this;
    }
    return Hero;
}(Character));
/**  Tracking what's on the card */
var Attributes = /** @class */ (function () {
    function Attributes() {
        // Cost in gold
        this.cost = 0;
        // Sum total effective attack and health
        this.health = 0;
        this.attack = 0;
        // Effective armor, not including squad leader. Some things come with armor or can have armor added
        this.armor = 0;
        // The number of things this will obliterate on attack
        this.obliterate = 0;
        // From here on down are counters - the number of times this keyword is effective on this card
        this.swiftStrike = 0;
        this.frenzy = 0;
        this.stealth = 0;
        this.flying = 0;
        this.antiAir = 0;
        this.longRange = 0;
        this.unstoppable = 0;
        this.invisible = 0;
        this.overpower = 0;
        this.readiness = 0;
        this.haste = 0;
        // Counting how many runes are on the card
        this.timeRunes = 0;
        this.damage = 0;
        this.plusOneOne = 0;
        this.minusOneOne = 0;
        this.featherRunes = 0;
        this.crumblingRunes = 0;
    }
    return Attributes;
}());

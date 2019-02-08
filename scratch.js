

// TODO: Cleaning up the card properties and constants and what must be defined etc will be key

class GenericCard {

    onArrive() {
        // let's try modeling a card that gets tokens, targets another character for deletion, and impacts the effective health of all skeletons
    } 
}

class Trigger {
    // a trigger is a function (behavioral unit) and a descriptor
    // triggers can prompt for targets

    // where could be like an ENUM or something
    // this probably goes somewhere else...
    static findCards(where, cardProperty, propertyValueEquals) {
        if (where == "in play") { // obv do this in a better way...
            return cardsInPlay.filter(card => card[cardProperty] == propertyValueEquals);
        }
    }
}

// could generically add tokens to any card or cards
// would take as parameters the token type, the number of tokens, and the cards to target
class TokenAddTrigger extends Trigger {
    // needs types

    constructor(tokenType, numberOfTokens, targetCards) {
        super();

        this.describe = "Add " + numberOfTokens + " " + tokenType + " to " + Card.cardNamesString(targetCards);

        this.fn = function() {
            for (let card of targetCards) {
                console.log(card);
                card[tokenType] += numberOfTokens;
            }
        }
    }
}


// should use an interface defining basehealth etc... this is so ugly without constants, groupings
// we will need a way to disambiguate the cards, so we can target specific cards. maybe we number them in play
class Card {
    // should group tokens and modifiable things somehow
    constructor() {
        this.plusOneOneTokens = 0;
    }

    static cardNamesString(cards) { 
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


// gets some tokens itself, targets something else for deletion, and impacts the effective health of all skeletons
// so actually returns a stack of three different triggers when it arrives...
class TestCard extends Card {
    constructor() {
        super();
    }
    onArrive() { 
        return [ new TokenAddTrigger("plusOneOneTokens", 1, Trigger.findCards("in play", "type", Skeleton.type)),
                 new TokenAddTrigger("plusOneOneTokens", 3, [ this ]) ];

    }
}
TestCard.type = "Test";


class Skeleton extends Card {
    constructor() {
        super();
        this.baseHealth = 1;
        this.effectiveHealth = this.baseHealth;
        this.type = Skeleton.type;
    }
}
Skeleton.type = "Skeleton";

class Bird extends Card {
    constructor() {
        super();
        this.baseHealth = 1;
        this.effectiveHealth = this.baseHealth; // boiler plate setup we should abstract somewhere
        this.type = Bird.type;
    }
}
Bird.type = "Bird";




// game will need "arrives" global function, which will call each card function, each of which will build trigger functions
// ... but how do the trigger functions move cards and impact other cards? moving cards, impacting other cards will be tricky
// just a test... creating cards in play
var cardsInPlay = [ new Skeleton(), new Bird(), new Skeleton(), new Bird() ]

// locates all skeletons in play

console.log(Trigger.findCards("in play", "type", Skeleton.type))
var testCard = new TestCard();
// a card arrives! ... will need to add default arrive logic, though
var onArrivesTriggers = testCard.onArrive();
console.log(onArrivesTriggers[0]); 
// run the first trigger, which should add a plus one/one to all skeletons
onArrivesTriggers[0].fn();

console.log(cardsInPlay);


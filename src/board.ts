
/** This class will essentially represent an entire player state */
class Board {
    public playerNumber: number;
    public turnCount: number = 0;

    public gold: number = 0;

    public hand: Array<Card> = [];
    public deck: Array<Card> = [];
    public discard: Array<Card> = [];
    public workers: Array<Card> = [];
    public startingWorkers: number;

    public inPlay: Array<Card> = [];
    public heroZone: Array<Hero> = [];
    public patrolZone: PatrolZone = new PatrolZone();

    public baseHealth: number = 20;
 
    public tech1: TechBuilding = null;
    public tech2: TechBuilding = null;
    public tech3: TechBuilding = null;

    public addOn: AddOn = null;

    constructor(playerNumber: number) {
        this.playerNumber = playerNumber;

        if (playerNumber == 1) {
            this.startingWorkers = 4;
        }
        else {
            this.startingWorkers = 5;
        }
    }

    public drawCards(howMany: number) {
        // If we need to draw more than we have, shuffle the discard pile
        if (this.deck.length < howMany) {
            this.shuffleDiscard();
            this.deck.concat(this.discard);
            this.discard = [];
        }

        this.hand = this.deck.splice(0, howMany);
    }

    private shuffleDiscard() {
        let j, x, i;
        for (i = this.discard.length - 1; i > 0; i--) {
            j = Math.floor(Math.random() * (i + 1));
            x = this.deck[i];
            this.discard[i] = this.discard[j];
            this.discard[j] = x;
        }
    }

    // think this should actually be an upkeep trigger...
    public collectGold(): number {
        // slow time generator will impact this, so we're going to need to look for cards that impact gold
        return (this.gold += this.startingWorkers + this.workers.length)
    }
}

/** Works differently from card buildings in pretty much every respect */
abstract class BoardBuilding {
    public readonly abstract maxHealth: number;
    public health: number;
    public destroyed = false;
    public constructionInProgress = true;
    
    protected playerBoard: Board;

    constructor(playerBoard: Board, buildInstantly: boolean = false) {
        // Need this to decrement base health when buildings blow up
        this.playerBoard = playerBoard;

        if (buildInstantly) {
            this.constructionInProgress = false;
        }
    }
 
    /** Upon taking damage, reduce health. Don't check destroyed here; we'll do that in the game state loop  */
    public damage(amt: number) {
        this.health -= amt;
    }

    /** Upon destruction, we mark the building destroyed and decrement base health */
    public destroy() {
        this.destroyed = true;
        this.playerBoard.baseHealth -= 2;
        // new construction will begin at the start of the player's next turn
    }

    /** At the end of the player's turn, finish construction */
    public finishConstruction() {
        this.constructionInProgress = false;
        this.health = this.maxHealth;
    }
}

class AddOn extends BoardBuilding {
    public readonly maxHealth: number = 4;
}

class TechBuilding extends BoardBuilding {
    public level: number;
    public readonly maxHealth: number = 5;

    constructor(level: number, playerBoard: Board, buildInstantly: boolean = false) {
        super(playerBoard, buildInstantly);
        this.level = level;
    }

    /** For the start of the player's turn, when we begin reconstructing  */
    public reconstruct() {
        this.destroyed = false;
        this.constructionInProgress = true;
    }
}

class PatrolZone {
    public squadLeader: Card;
    public elite: Card;
    public scavenger: Card;
    public technician: Card;
    public lookout: Card;
}
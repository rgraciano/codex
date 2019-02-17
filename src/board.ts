
import { Card, Hero, Effect } from './cards/card';
import { Trigger } from 'trigger';

/** This class will essentially represent an entire player state */
export class Board {
    playerNumber: number;
    turnCount: number = 0;

    gold: number = 0;

    hand: Array<Card> = [];
    deck: Array<Card> = [];
    discard: Array<Card> = [];
    workers: Array<Card> = [];
    effects: Array<Effect> = [];
    startingWorkers: number;

    inPlay: Array<Card> = [];
    heroZone: Array<Hero> = [];
    patrolZone: PatrolZone = new PatrolZone();

    baseHealth: number = 20;

    tech1: TechBuilding = null;
    tech2: TechBuilding = null;
    tech3: TechBuilding = null;

    addOn: AddOn = null;

    constructor(playerNumber: number) {
        this.playerNumber = playerNumber;

        if (playerNumber == 1) {
            this.startingWorkers = 4;
        }
        else {
            this.startingWorkers = 5;
        }
    }

    drawCards(howMany: number) {
        // If we need to draw more than we have, shuffle the discard pile
        if (this.deck.length < howMany) {
            this.shuffleDiscard();
            this.deck = this.deck.concat(this.discard);
            this.discard = [];
        }

        this.hand = this.deck.splice(0, howMany);
    }

    private shuffleDiscard() {
        let j, x, i;
        for (i = this.discard.length - 1; i > 0; i--) {
            j = Math.floor(Math.random() * (i + 1));
            x = this.discard[i];
            this.discard[i] = this.discard[j];
            this.discard[j] = x;
        }
    }

    // think this should actually be an upkeep trigger...
    collectGold(): number {
        // slow time generator will impact this, so we're going to need to look for cards that impact gold
        return (this.gold += this.startingWorkers + this.workers.length);
    }
}

/** Works differently from card buildings in pretty much every respect */
abstract class BoardBuilding {
    readonly abstract maxHealth: number;
    health: number;
    destroyed = false;
    constructionInProgress = true;
    
    protected playerBoard: Board;

    constructor(playerBoard: Board, buildInstantly: boolean = false) {
        // Need this to decrement base health when buildings blow up
        this.playerBoard = playerBoard;

        if (buildInstantly) {
            this.constructionInProgress = false;
        }
    }

    /** Upon taking damage, reduce health. Don't check destroyed here; we'll do that in the game state loop  */
    damage(amt: number) {
        this.health -= amt;
    }

    /** Upon destruction, we mark the building destroyed and decrement base health */
    destroy() {
        this.destroyed = true;
        this.playerBoard.baseHealth -= 2;
        // new construction will begin at the start of the player's next turn
    }

    /** At the end of the player's turn, finish construction */
    finishConstruction() {
        this.constructionInProgress = false;
        this.health = this.maxHealth;
    }
}

class AddOn extends BoardBuilding {
    readonly maxHealth: number = 4;
}

class TechBuilding extends BoardBuilding {
    level: number;
    readonly maxHealth: number = 5;

    constructor(level: number, playerBoard: Board, buildInstantly: boolean = false) {
        super(playerBoard, buildInstantly);
        this.level = level;
    }

    /** For the start of the player's turn, when we begin reconstructing  */
    reconstruct() {
        this.destroyed = false;
        this.constructionInProgress = true;
    }
}

export class PatrolZone {
    squadLeader: Card = null;
    elite: Card = null;
    scavenger: Card = null;
    technician: Card = null;
    lookout: Card = null;
}
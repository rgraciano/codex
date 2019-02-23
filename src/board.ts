
import { Card, Hero, Effect } from './cards/card';
import { EventDescriptor } from './game';
import { ObjectMap } from './serialize';

/** This class will essentially represent an entire player state */
export class Board {
    playerNumber: number;
    turnCount: number = 0;

    gold: number = 0;

    hand: Array<Card> = [];
    deck: Array<Card> = [];
    discard: Array<Card> = [];
    workers: Array<Card> = [];
    startingWorkers: number;

    heroZone: Array<Hero> = [];

    // These things are "active" - cards that are in play somewhere
    inPlay: Array<Card> = [];
    effects: Array<Effect> = [];
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

    serialize(): ObjectMap {
        let pojo: ObjectMap = new ObjectMap();

        pojo.playerNumber = this.playerNumber;
        pojo.turnCount = this.turnCount;
        pojo.gold = this.gold;
        pojo.baseHealth = this.baseHealth;

        pojo.hand = Card.serializeCards(this.hand);
        pojo.deck = Card.serializeCards(this.deck);
        pojo.discard = Card.serializeCards(this.discard);
        pojo.workers = Card.serializeCards(this.workers);
        pojo.heroZone = Card.serializeCards(this.heroZone);
        pojo.inPlay = Card.serializeCards(this.inPlay);

        pojo.patrolZone = PatrolZone.serialize(this.patrolZone); // break from convention here b/c instance method screws up property iteration on pz

        if (this.tech1) pojo.tech1 = this.tech1.serialize();
        if (this.tech2) pojo.tech2 = this.tech2.serialize();
        if (this.tech3) pojo.tech3 = this.tech3.serialize();

        if (this.addOn) pojo.addOn = this.addOn.serialize();

        return pojo;
    }

    static deserialize(pojo: ObjectMap): Board {
        let board = new Board(<number>pojo.playerNumber);

        board.turnCount = <number>pojo.turnCount;
        board.gold = <number>pojo.gold;
        board.baseHealth = <number>pojo.baseHealth;

        board.hand = Card.deserializeCards(<Array<ObjectMap>>pojo.hand);
        board.deck = Card.deserializeCards(<Array<ObjectMap>>pojo.deck);
        board.discard = Card.deserializeCards(<Array<ObjectMap>>pojo.discard);
        board.workers = Card.deserializeCards(<Array<ObjectMap>>pojo.workers);
        board.heroZone = <Array<Hero>>Card.deserializeCards(<Array<ObjectMap>>pojo.heroZone);
        board.inPlay = Card.deserializeCards(<Array<ObjectMap>>pojo.inPlay);

        board.patrolZone = PatrolZone.deserialize(<ObjectMap>pojo.patrolZone);

        if (pojo.tech1) board.tech1 = TechBuilding.deserialize(<ObjectMap>pojo.tech1, board);
        if (pojo.tech2) board.tech2 = TechBuilding.deserialize(<ObjectMap>pojo.tech2, board);
        if (pojo.tech3) board.tech3 = TechBuilding.deserialize(<ObjectMap>pojo.tech3, board);

        if (pojo.addOn) board.addOn = AddOn.deserialize(<ObjectMap>pojo.addOn, board);

        return board;
    }

    drawCards(howMany: number) {
        // If we need to draw more than we have, shuffle the discard pile.  TODO: Limit to one reshuffle per turn
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
    collectGold(): EventDescriptor {
        // TODO: slow time generator will impact this, so we're going to need to look for cards that impact gold
        let collected: number = this.startingWorkers + this.workers.length;
        this.gold += collected;
        return new EventDescriptor('CollectGold', 'Collected ' + collected + ' gold');
    }

    /** Verifies a card is in a specific space.  Returns null if it can't be found */
    findCardById(space: Array<Card>, cardId: string): (Card | undefined) {
        let card: Card = Card.idToCardMap.get(cardId);

        if (card === undefined || space.indexOf(card) === -1) {
            return undefined;
        }

        return card;
    }

    /**
     *  Moves a card from one area to another, e.g. hand to play space, play to discard, etc.
     *  If toSpace is omitted then the card is simply removed.
     */
    moveCard(fromSpace: Array<Card>, card: Card, toSpace?: Array<Card>): boolean {
        let index = fromSpace.indexOf(card);
        
        if (index === -1) {
            return false;
        }

        fromSpace.splice(index, 1);

        if (toSpace)
            toSpace.push(card);
            
        return true;
    }

    getPatrolZoneAsArray(): Array<Card> {
        let a: Array<Card> = [];

        for (let thing in this) {
            a.push(this.patrolZone[thing]);
        }

        return a;
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

    serialize(): ObjectMap {
        let pojo = new ObjectMap();
        pojo.maxHealth = this.maxHealth;
        pojo.health = this.health;
        pojo.destroyed = this.destroyed;
        pojo.constructionInProgress = this.constructionInProgress;
        return pojo;
    }

    static deserializeCommonProperties(bb: BoardBuilding, pojo: ObjectMap): void {
        bb.health = <number>pojo.health;
        bb.destroyed = <boolean>pojo.destroyed;
        bb.constructionInProgress = <boolean>pojo.constructionInProgress;
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

    static deserialize(pojo: ObjectMap, playerBoard: Board): AddOn {
        let ao = new AddOn(playerBoard);
        BoardBuilding.deserializeCommonProperties(ao, pojo);
        return ao;
    }
}

class TechBuilding extends BoardBuilding {
    level: number;
    readonly maxHealth: number = 5;

    constructor(level: number, playerBoard: Board, buildInstantly: boolean = false) {
        super(playerBoard, buildInstantly);
        this.level = level;
    }

    serialize(): ObjectMap {
        let pojo: ObjectMap = super.serialize();
        pojo.level = this.level;
        return pojo;
    }

    static deserialize(pojo: ObjectMap, playerBoard: Board): TechBuilding {
        let tb = new TechBuilding(<number>pojo.level, playerBoard);
        BoardBuilding.deserializeCommonProperties(tb, pojo);
        return tb;
    }

    /** For the start of the player's turn, when we begin reconstructing  */
    reconstruct() {
        this.destroyed = false;
        this.constructionInProgress = true;
    }
}

export class PatrolZone {
    [key: string]: Card;
    squadLeader: Card = null;
    elite: Card = null;
    scavenger: Card = null;
    technician: Card = null;
    lookout: Card = null;

    static serialize(pz: PatrolZone): ObjectMap {
        let objmap = new ObjectMap();
        for (let key in this) {
            if (key)
                objmap[key] = pz[key].serialize();
        }
        return objmap;
    }

    static deserialize(pojo: ObjectMap): PatrolZone {
        let pz = new PatrolZone();
        for (let key in pojo) {
            pz[key] = Card.deserialize(<ObjectMap>pojo[key]);
        }

        return pz;
    }
}


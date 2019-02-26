
import { Card, Hero, Effect } from './cards/card';
import { Game, EventDescriptor } from './game';
import { ObjectMap } from './game_server';

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

    base: BoardBuilding;

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
        let pojo: ObjectMap = {
            playerNumber: this.playerNumber,
            turnCount: this.turnCount,
            gold: this.gold,
            base: this.base.serialize(),

            hand: Card.serializeCards(this.hand),
            deck: Card.serializeCards(this.deck),
            discard: Card.serializeCards(this.discard),
            workers: Card.serializeCards(this.workers),
            heroZone: Card.serializeCards(this.heroZone),
            inPlay: Card.serializeCards(this.inPlay),

            patrolZone: PatrolZone.serialize(this.patrolZone), // break from convention here b/c instance method screws up property iteration on pz
        };

        if (this.tech1) pojo.tech1 = this.tech1.serialize();
        if (this.tech2) pojo.tech2 = this.tech2.serialize();
        if (this.tech3) pojo.tech3 = this.tech3.serialize();

        if (this.addOn) pojo.addOn = this.addOn.serialize();

        return pojo;
    }

    static deserialize(pojo: ObjectMap, game: Game): Board {
        let board = new Board(<number>pojo.playerNumber);

        board.turnCount = <number>pojo.turnCount;
        board.gold = <number>pojo.gold;
        board.base = BoardBuilding.deserialize(<ObjectMap>pojo.base);

        board.hand = Card.deserializeCards(<Array<ObjectMap>>pojo.hand, game);
        board.deck = Card.deserializeCards(<Array<ObjectMap>>pojo.deck, game);
        board.discard = Card.deserializeCards(<Array<ObjectMap>>pojo.discard, game);
        board.workers = Card.deserializeCards(<Array<ObjectMap>>pojo.workers, game);
        board.heroZone = <Array<Hero>>Card.deserializeCards(<Array<ObjectMap>>pojo.heroZone, game);
        board.inPlay = Card.deserializeCards(<Array<ObjectMap>>pojo.inPlay, game);

        board.patrolZone = PatrolZone.deserialize(<ObjectMap>pojo.patrolZone, game);

        if (pojo.tech1) board.tech1 = TechBuilding.deserialize(<ObjectMap>pojo.tech1);
        if (pojo.tech2) board.tech2 = TechBuilding.deserialize(<ObjectMap>pojo.tech2);
        if (pojo.tech3) board.tech3 = TechBuilding.deserialize(<ObjectMap>pojo.tech3);

        if (pojo.addOn) board.addOn = AddOn.deserialize(<ObjectMap>pojo.addOn);

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

        for (let thing in this.patrolZone) {
            a.push(this.patrolZone[thing]);
        }

        return a;
    }
}

/** Works differently from card buildings in pretty much every respect */
export class BoardBuilding {
    readonly maxHealth: number = 20; // base health by default
    private _health: number = this.maxHealth;
    destroyed = false;
    constructionInProgress = true;
    name: string;

    constructor(name: string, buildInstantly: boolean = false) {
        this.name = name;
        if (buildInstantly) {
            this.constructionInProgress = false;
        }
    }

    serialize(): ObjectMap {
        return {
            maxHealth: this.maxHealth,
            _health: this._health,
            destroyed: this.destroyed,
            constructionInProgress: this.constructionInProgress
        };  
    }

    static deserialize(pojo: ObjectMap): BoardBuilding {
        let bb = new BoardBuilding(<string>pojo.name);
        BoardBuilding.deserializeCommonProperties(bb, pojo);
        return bb;
    }

    static deserializeCommonProperties(bb: BoardBuilding, pojo: ObjectMap): void {
        bb._health = <number>pojo._health;
        bb.destroyed = <boolean>pojo.destroyed;
        bb.constructionInProgress = <boolean>pojo.constructionInProgress;
    }

    /** Upon taking damage, reduce health. Don't check destroyed here; we'll do that in the game state loop  */
    damage(amt: number, attributeTo: Card): EventDescriptor {
        this._health -= amt;
        return new EventDescriptor('BuildingDamage', this.name + ' took ' + amt + ' damage from ' + attributeTo.name, { amount: amt, attributeTo: attributeTo.cardId });
    }

    /** At the end of the player's turn, finish construction */
    finishConstruction() {
        this.constructionInProgress = false;
        this._health = this.maxHealth;
    }
}

class AddOn extends BoardBuilding {
    readonly maxHealth: number = 4;

    static deserialize(pojo: ObjectMap): AddOn {
        let ao = new AddOn(<string>pojo.name);
        BoardBuilding.deserializeCommonProperties(ao, pojo);
        return ao;
    }
}

class TechBuilding extends BoardBuilding {
    level: number;
    readonly maxHealth: number = 5;

    constructor(name: string, level: number, buildInstantly: boolean = false) {
        super(name, buildInstantly);
        this.level = level;
    }

    serialize(): ObjectMap {
        let pojo: ObjectMap = super.serialize();
        pojo.level = this.level;
        return pojo;
    }

    static deserialize(pojo: ObjectMap): TechBuilding {
        let tb = new TechBuilding(<string>pojo.name, <number>pojo.level);
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

    static deserialize(pojo: ObjectMap, game: Game): PatrolZone {
        let pz = new PatrolZone();
        for (let key in pojo) {
            pz[key] = Card.deserialize(<ObjectMap>pojo[key], game);
        }

        return pz;
    }
}


import { Card, Hero, TechLevel } from './cards/card';
import { Game, EventDescriptor } from './game';
import { ObjectMap } from './game_server';
import { Spec } from './cards/color';

export type BuildingType = 'Base' | 'Tech 1' | 'Tech 2' | 'Tech 3' | 'AddOn';
export type AddOnType = 'Tower' | 'Surplus' | 'Heroes Hall' | 'Tech Lab' | 'None';
export type BuildingOrAddOnType = BuildingType | AddOnType;

/** This class will essentially represent an entire player state */
export class Board {
    playerNumber: number;
    chosenSpecs: Spec[];
    multiColor: boolean = false;
    workeredThisTurn: boolean = false;

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
    effects: Array<Card> = [];
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
        } else {
            this.startingWorkers = 5;
        }
    }

    workerCount(): number {
        return this.workers.length + this.startingWorkers;
    }

    serialize(): ObjectMap {
        let pojo: ObjectMap = {
            playerNumber: this.playerNumber,
            chosenSpecs: this.chosenSpecs,
            multiColor: this.multiColor,

            turnCount: this.turnCount,
            gold: this.gold,
            base: this.base.serialize('Base', this.gold, this.workerCount(), this.multiColor),

            hand: Card.serializeCards(this.hand),
            deck: Card.serializeCards(this.deck),
            discard: Card.serializeCards(this.discard),
            workers: Card.serializeCards(this.workers),
            heroZone: Card.serializeCards(this.heroZone),
            inPlay: Card.serializeCards(this.inPlay),

            numWorkers: this.workers.length + this.startingWorkers, // for the client
            workeredThisTurn: this.workeredThisTurn,
            canWorker: this.canWorker(),

            patrolZone: PatrolZone.serialize(this.patrolZone) // break from convention here b/c instance method screws up property iteration on pz
        };

        pojo.tech1 = this.tech1.serialize('Tech 1', this.gold, this.workerCount(), this.multiColor);
        pojo.tech2 = this.tech2.serialize('Tech 2', this.gold, this.workerCount(), this.multiColor);
        pojo.tech3 = this.tech3.serialize('Tech 3', this.gold, this.workerCount(), this.multiColor);

        pojo.addOn = this.addOn.serialize(this.addOn.addOnType, this.gold, this.workerCount(), this.multiColor);

        return pojo;
    }

    static deserialize(pojo: ObjectMap, game: Game): Board {
        let board = new Board(<number>pojo.playerNumber);

        board.chosenSpecs = <Spec[]>pojo.chosenSpecs;
        board.multiColor = <boolean>pojo.boolean;

        board.turnCount = <number>pojo.turnCount;
        board.gold = <number>pojo.gold;
        board.base = BoardBuilding.deserialize(<ObjectMap>pojo.base);
        board.workeredThisTurn = <boolean>pojo.workeredThisTurn;

        board.hand = Card.deserializeCards(<Array<ObjectMap>>pojo.hand);
        board.deck = Card.deserializeCards(<Array<ObjectMap>>pojo.deck);
        board.discard = Card.deserializeCards(<Array<ObjectMap>>pojo.discard);
        board.workers = Card.deserializeCards(<Array<ObjectMap>>pojo.workers);
        board.heroZone = <Array<Hero>>Card.deserializeCards(<Array<ObjectMap>>pojo.heroZone);
        board.inPlay = Card.deserializeCards(<Array<ObjectMap>>pojo.inPlay);

        board.patrolZone = PatrolZone.deserialize(<ObjectMap>pojo.patrolZone);

        board.tech1 = TechBuilding.deserialize(<ObjectMap>pojo.tech1);
        board.tech2 = TechBuilding.deserialize(<ObjectMap>pojo.tech2);
        board.tech3 = TechBuilding.deserialize(<ObjectMap>pojo.tech3);

        board.addOn = AddOn.deserialize(<ObjectMap>pojo.addOn);

        return board;
    }

    canWorker(): boolean {
        return this.gold >= this.getWorkerCost() && !this.workeredThisTurn;
    }

    getWorkerCost(): number {
        let workerCostAlterations = Game.findCardsWithProperty(this.inPlay, 'workersAreFree');
        return workerCostAlterations.length > 0 ? 0 : 1;
    }

    destroyIfRequired(building: BuildingType): EventDescriptor[] | false {
        switch (building) {
            case 'Base':
                return this.base.shouldBeDestroyed() ? this.destroyBuilding('Base') : false;

            case 'Tech 1':
                return this.tech1 && this.tech1.shouldBeDestroyed() ? this.destroyBuilding('Tech 1') : false;

            case 'Tech 2':
                return this.tech2 && this.tech2.shouldBeDestroyed() ? this.destroyBuilding('Tech 2') : false;

            case 'Tech 3':
                return this.tech3 && this.tech3.shouldBeDestroyed() ? this.destroyBuilding('Tech 3') : false;

            case 'AddOn':
                return this.addOn && this.addOn.shouldBeDestroyed() ? this.destroyBuilding('AddOn') : false;

            default:
                return [];
        }
    }

    destroyBuilding(building: BuildingType): EventDescriptor[] {
        let events: EventDescriptor[] = [];

        if (building == 'Base') {
            events.push(
                new EventDescriptor('GameOver', 'Player ' + this.playerNumber + ' base is destroyed! The game is over', {
                    destroyed: this.playerNumber
                })
            );
        } else {
            events.push(this.base.damage(2));

            if (building.startsWith('Tech')) {
                let buildingNumber: string;

                switch (building) {
                    case 'Tech 1':
                        this.tech1.destroy();
                        buildingNumber = '1';
                        break;
                    case 'Tech 2':
                        this.tech2.destroy();
                        buildingNumber = '2';
                        break;
                    case 'Tech 3':
                        this.tech3.destroy();
                        buildingNumber = '3';
                        break;
                }

                events.push(
                    new EventDescriptor(
                        'BuildingDestroyed',
                        'Player ' + this.playerNumber + ' Tech ' + buildingNumber + ' building was destroyed',
                        { destroyed: building }
                    )
                );
            } else if (building == 'AddOn') {
                events.push(
                    new EventDescriptor('BuildingDestroyed', 'Player ' + this.playerNumber + ' add on building was destroyed', {
                        destroyed: building
                    })
                );
                this.addOn = null;
            }
        }

        return events;
    }

    techBuildingIsActive(techLevel: TechLevel): boolean {
        if (techLevel == 0) return true;

        let bldg: TechBuilding = Reflect.get(this, 'tech' + new Number(techLevel).toString());

        if (!bldg) return false;

        if (bldg.constructionInProgress || bldg.destroyed || bldg.disabled) return false;

        return true;
    }

    addOnIsActive(): boolean {
        return this.addOn && !this.addOn.constructionInProgress && !this.addOn.destroyed && this.addOn.health > 0;
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
    findCardById(space: Array<Card>, cardId: string): Card | undefined {
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

        if (toSpace) toSpace.push(card);

        return true;
    }

    getPatrolZoneAsArray(): Card[] {
        let a: Card[] = [];

        for (let thing in this.patrolZone) {
            if (this.patrolZone[thing]) a.push(this.patrolZone[thing]);
        }

        return a;
    }
}

/** Works differently from card buildings in pretty much every respect */
export class BoardBuilding {
    readonly maxHealth: number = 20; // base health by default
    private _health: number = this.maxHealth;
    destroyed = false;
    constructionInProgress = false;
    name: string;
    built: boolean = false;
    disabled: boolean = false;

    constructor(name: BuildingType) {
        this.name = name;
        if (this.name == 'Base') this.built = true;
    }

    canBuild(type: BuildingOrAddOnType, gold: number, workers: number, multiColor: boolean = false): boolean {
        return false; // default for base
    }

    build(buildInstantly: boolean = false) {
        this.built = true;
        this.constructionInProgress = !buildInstantly;
    }

    serialize(type: BuildingOrAddOnType, gold: number, workers: number, multiColor: boolean = false): ObjectMap {
        return {
            maxHealth: this.maxHealth,
            _health: this._health,
            name: this.name,
            destroyed: this.destroyed,
            built: this.built,
            constructionInProgress: this.constructionInProgress,
            canBuild: this.canBuild(type, gold, workers, multiColor),
            disabled: this.disabled
        };
    }

    static deserialize(pojo: ObjectMap): BoardBuilding {
        let bb = new BoardBuilding(<BuildingType>pojo.name);
        BoardBuilding.deserializeCommonProperties(bb, pojo);
        return bb;
    }

    static deserializeCommonProperties(bb: BoardBuilding, pojo: ObjectMap): void {
        bb._health = <number>pojo._health;
        bb.destroyed = <boolean>pojo.destroyed;
        bb.built = <boolean>pojo.built;
        bb.constructionInProgress = <boolean>pojo.constructionInProgress;
        bb.disabled = <boolean>pojo.disabled;
    }

    shouldBeDestroyed(): boolean {
        return this._health <= 0;
    }

    /** Upon taking damage, reduce health. Don't check destroyed here; we'll do that in the game state loop  */
    damage(amt: number, attributeTo?: Card): EventDescriptor {
        this._health -= amt;

        let description = this.name + ' took ' + amt + ' damage';

        let context: ObjectMap = { amount: amt };

        if (attributeTo) {
            description += ' from ' + attributeTo.name;
            context.attributeTo = attributeTo.cardId;
        }

        return new EventDescriptor('BuildingDamage', description, context);
    }

    get health(): number {
        return this._health;
    }

    resetHealth() {
        this._health = this.maxHealth;
    }

    /** At the end of the player's turn, finish construction */
    finishConstruction() {
        this.constructionInProgress = false;
        this.destroyed = false;
        this.resetHealth();
    }
}

export class AddOn extends BoardBuilding {
    readonly maxHealth: number = 4;
    addOnType: AddOnType;
    towerDetectedThisTurn: boolean = false;
    techLabSpec: Spec;

    canBuild(type: AddOnType, gold: number, workers: number, multiColor: boolean = false): boolean {
        if (this.built) return false;

        switch (type) {
            case 'Tower':
                return gold >= 3;
            case 'Surplus':
                return gold >= 5;
            case 'Heroes Hall':
                return gold >= 2;
            default:
                // tech lab or none
                return gold >= 1;
        }
    }

    serialize(type: BuildingOrAddOnType, gold: number, workers: number, multiColor: boolean = false): ObjectMap {
        let pojo: ObjectMap = super.serialize(type, gold, workers, multiColor);
        pojo.addOnType = this.addOnType;
        pojo.towerDetectedThisTurn = this.towerDetectedThisTurn;
        pojo.canBuild = this.canBuild('Tech Lab', gold, 0);
        pojo.canBuildTower = this.canBuild('Tower', gold, 0);
        pojo.canBuildSurplus = this.canBuild('Surplus', gold, 0);
        pojo.canBuildHeroesHall = this.canBuild('Heroes Hall', gold, 0);
        pojo.canBuildTechLab = this.canBuild('Tech Lab', gold, 0);

        if (this.techLabSpec) pojo.techLabSpec = this.techLabSpec;

        return pojo;
    }

    static deserialize(pojo: ObjectMap): AddOn {
        let ao = new AddOn(<BuildingType>pojo.name);
        BoardBuilding.deserializeCommonProperties(ao, pojo);
        ao.addOnType = <AddOnType>pojo.addOnType;
        ao.towerDetectedThisTurn = <boolean>pojo.towerDetectedThisTurn;

        if (pojo.techLabSpec) ao.techLabSpec = <Spec>pojo.techLabSpec;

        return ao;
    }
}

export class TechBuilding extends BoardBuilding {
    level: number;
    spec: Spec; // for Tech 2 only

    readonly maxHealth: number = 5;

    constructor(name: BuildingType, level: number) {
        super(name);
        this.level = level;
    }

    serialize(type: BuildingOrAddOnType, gold: number, workers: number, multiColor: boolean = false): ObjectMap {
        let pojo: ObjectMap = super.serialize(type, gold, workers, multiColor);
        pojo.level = this.level;
        pojo.spec = this.spec;
        return pojo;
    }

    destroy() {
        this.destroyed = true;
        this.resetHealth();
    }

    canBuild(type: BuildingType, gold: number, workers: number, multiColor: boolean = false): boolean {
        if (this.built) return false;

        switch (type) {
            case 'Tech 1':
                let reqGold = multiColor ? 2 : 1;
                return gold >= reqGold && workers >= 6;
            case 'Tech 2':
                return gold >= 4 && workers >= 8;
            case 'Tech 3':
                return gold >= 5 && workers >= 10;
        }
    }

    static deserialize(pojo: ObjectMap): TechBuilding {
        let tb = new TechBuilding(<BuildingType>pojo.name, <number>pojo.level);
        tb.spec = <Spec>pojo.spec;
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
            if (key) objmap[key] = pz[key].serialize();
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

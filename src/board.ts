import { Card, TechLevel, Building } from './cards/card';
import { Hero } from './cards/hero';
import { CardApi } from './cards/card_api';
import { Game, EventDescriptor } from './game';
import { ObjectMap } from './game_server';
import { Spec } from './cards/color';
import { UntilSpell } from './cards/spell';

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

    hand: Card[] = [];
    deck: Card[] = [];
    discard: Card[] = [];
    workers: Card[] = [];
    playStagingArea: Card[] = [];
    startingWorkers: number;

    heroZone: Hero[] = [];

    // These things are "active" - cards that are in play somewhere
    inPlay: Card[] = [];
    activeSpells: UntilSpell[] = [];
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
            playStagingArea: Card.serializeCards(this.playStagingArea),

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

        board.workers = Card.deserializeCards(<ObjectMap[]>pojo.workers);
        board.multiColor = <boolean>pojo.boolean;

        board.chosenSpecs = <Spec[]>pojo.chosenSpecs;
        board.turnCount = <number>pojo.turnCount;
        board.gold = <number>pojo.gold;
        board.workeredThisTurn = <boolean>pojo.workeredThisTurn;

        board.playStagingArea = Card.deserializeCards(<ObjectMap[]>pojo.playStagingArea);
        board.hand = Card.deserializeCards(<ObjectMap[]>pojo.hand);
        board.deck = Card.deserializeCards(<ObjectMap[]>pojo.deck);
        board.discard = Card.deserializeCards(<ObjectMap[]>pojo.discard);

        board.heroZone = <Hero[]>Card.deserializeCards(<ObjectMap[]>pojo.heroZone);
        board.inPlay = Card.deserializeCards(<ObjectMap[]>pojo.inPlay);

        board.patrolZone = PatrolZone.deserialize(<ObjectMap>pojo.patrolZone);

        board.base = BoardBuilding.deserialize(<ObjectMap>pojo.base, board);
        board.tech1 = TechBuilding.deserialize(<ObjectMap>pojo.tech1, board);
        board.tech2 = TechBuilding.deserialize(<ObjectMap>pojo.tech2, board);
        board.tech3 = TechBuilding.deserialize(<ObjectMap>pojo.tech3, board);

        board.addOn = AddOn.deserialize(<ObjectMap>pojo.addOn, board);

        return board;
    }

    canWorker(): boolean {
        return this.gold >= this.getWorkerCost() && !this.workeredThisTurn;
    }

    getWorkerCost(): number {
        return CardApi.checkWorkersAreFree(this) ? 0 : 1;
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

        return bldg.isActive();
    }

    static isBuildingId(id: string): boolean {
        return id == 'Base' || id == 'Tech 1' || id == 'Tech 2' || id == 'Tech 3' || id == 'AddOn';
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

    board: Board;

    constructor(name: BuildingType, board: Board) {
        this.name = name;
        if (this.name == 'Base') this.built = true;
        this.board = board;
    }

    isActive(): boolean {
        if (!this.built) return false;

        if (this.constructionInProgress || this.destroyed || this.disabled) return false;

        if (this.health <= 0) return false;

        return true;
    }

    canBuild(type: BuildingOrAddOnType): boolean {
        return false; // default for base
    }

    build(buildInstantly: boolean = false, type?: AddOnType) {
        this.board.gold -= this.getCost(type);
        this._health = this.maxHealth;
        this.built = true;
        this.disabled = false;
        this.constructionInProgress = !buildInstantly;
    }

    getCost(type?: AddOnType): number {
        switch (this.name) {
            case 'Base':
                return 0;
            case 'Tech 1':
                return this.board.multiColor ? 2 : 1;
            case 'Tech 2':
                return 4;
            case 'Tech 3':
                return 5;
        }

        switch (type) {
            case 'Surplus':
                return 5;
            case 'Tower':
                return 3;
            case 'Heroes Hall':
                return 2;
            case 'Tech Lab':
                return 1;
        }
    }

    serialize(type: BuildingOrAddOnType, gold: number, workers: number, multiColor: boolean = false): ObjectMap {
        return {
            maxHealth: this.maxHealth,
            _health: this._health,
            name: this.name,
            destroyed: this.destroyed,
            built: this.built,
            constructionInProgress: this.constructionInProgress,
            canBuild: this.canBuild(type),
            disabled: this.disabled
        };
    }

    static deserialize(pojo: ObjectMap, board: Board): BoardBuilding {
        let bb = new BoardBuilding(<BuildingType>pojo.name, board);
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
    towerRevealedThisTurn: boolean = false;
    techLabSpec: Spec;

    canBuild(type: AddOnType): boolean {
        if (this.built) return false;

        let gold = this.board.gold;

        switch (type) {
            case 'Tower':
                return gold >= 3;
            case 'Surplus':
                return gold >= 5;
            case 'Heroes Hall':
                return gold >= 2;
            case 'Tech Lab':
                return gold >= 1;
            default:
                return false;
        }
    }

    build(buildInstantly: boolean = false, type?: AddOnType) {
        super.build(buildInstantly, type);
        this.addOnType = type;
    }

    serialize(type: BuildingOrAddOnType, gold: number, workers: number, multiColor: boolean = false): ObjectMap {
        let pojo: ObjectMap = super.serialize(type, gold, workers, multiColor);
        pojo.addOnType = this.addOnType;
        pojo.towerRevealedThisTurn = this.towerRevealedThisTurn;
        pojo.canReveal =
            !this.towerRevealedThisTurn && !this.constructionInProgress && this.built && !this.destroyed && this.addOnType == 'Tower';
        pojo.canBuild = this.canBuild('Tech Lab');
        pojo.canBuildTower = this.canBuild('Tower');
        pojo.canBuildSurplus = this.canBuild('Surplus');
        pojo.canBuildHeroesHall = this.canBuild('Heroes Hall');
        pojo.canBuildTechLab = this.canBuild('Tech Lab');

        if (this.techLabSpec) pojo.techLabSpec = this.techLabSpec;

        return pojo;
    }

    static deserialize(pojo: ObjectMap, board: Board): AddOn {
        let ao = new AddOn(<BuildingType>pojo.name, board);
        BoardBuilding.deserializeCommonProperties(ao, pojo);
        ao.addOnType = <AddOnType>pojo.addOnType;
        ao.towerRevealedThisTurn = <boolean>pojo.towerRevealedThisTurn;

        if (pojo.techLabSpec) ao.techLabSpec = <Spec>pojo.techLabSpec;

        return ao;
    }
}

export class TechBuilding extends BoardBuilding {
    level: number;
    spec: Spec; // for Tech 2 only

    readonly maxHealth: number = 5;

    constructor(name: BuildingType, board: Board, level: number) {
        super(name, board);
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

    canBuild(type: BuildingType): boolean {
        if (this.built) return false;

        let gold = this.board.gold;
        let workers = this.board.workerCount();

        switch (type) {
            case 'Tech 1':
                let reqGold = this.board.multiColor ? 2 : 1;
                return gold >= reqGold && workers >= 6;
            case 'Tech 2':
                return gold >= 4 && workers >= 8;
            case 'Tech 3':
                return gold >= 5 && workers >= 10;
        }
    }

    static deserialize(pojo: ObjectMap, board: Board): TechBuilding {
        let tb = new TechBuilding(<BuildingType>pojo.name, board, <number>pojo.level);
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

    /** Finds which slot this card is in, or undefined */
    static getSlotNameForCard(pz: PatrolZone, card: Card): string {
        for (let key in pz) {
            if (pz[key] == card) return key;
        }

        return undefined;
    }

    static serialize(pz: PatrolZone): ObjectMap {
        let objmap = new ObjectMap();
        for (let key in pz) {
            if (pz[key]) objmap[key] = pz[key].serialize();
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

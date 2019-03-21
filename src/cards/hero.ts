import { Character, CardType } from './card';
import { ObjectMap } from '../game_server';
import { Game, EventDescriptor } from 'game';
import { CardApi } from './card_api';

export abstract class Hero extends Character {
    readonly cardType: CardType = 'Hero';

    abstract readonly midLevel: number;
    abstract readonly maxLevel: number;

    castsUltimateImmediately: boolean = false; // some heroes may set this to true, e.g. Prynn

    private _level: number = 1;
    private turnsTilAvailable: number = 0;
    private turnsTilCastUltimate: number = 1;

    serialize(): ObjectMap {
        let pojo = super.serialize();
        pojo.level = this.level;
        pojo.midLevel = this.midLevel;
        pojo.maxLevel = this.maxLevel;
        pojo.turnsTilAvailable = this.turnsTilAvailable;
        pojo.turnsTilCastUltimate = this.turnsTilCastUltimate;
        return pojo;
    }

    deserializeExtra(pojo: ObjectMap): void {
        this._level = <number>pojo.level;
        this.turnsTilAvailable = <number>pojo.turnsTilAvailable;
        this.turnsTilCastUltimate = <number>pojo.turnsTilCastUltimate;
    }

    canCastUltimate(): boolean {
        return this.level == this.maxLevel && this.turnsTilCastUltimate === 0;
    }

    canBeSummoned() {
        return this.turnsTilAvailable === 0;
    }

    markCantBeSummonedNextTurn() {
        this.turnsTilAvailable = 2;
    }

    get level() {
        return this._level;
    }

    set level(newLvl: number) {
        if (newLvl > this.maxLevel) newLvl = this.maxLevel;

        if (newLvl > this._level) {
            let hittingMid = false,
                hittingMax = false;

            if (this._level < this.midLevel && newLvl >= this.midLevel) {
                hittingMid = true;
            }

            if (this._level < this.maxLevel && newLvl == this.maxLevel) {
                hittingMax = true;
            }

            this._level = newLvl;

            if (hittingMid || hittingMax) {
                this.healAllDamage();
            }

            if (hittingMid) CardApi.hook(this.game, 'heroMid', [], 'None', this);
            if (hittingMax) CardApi.hook(this.game, 'heroMax', [], 'None', this);

            if (hittingMax) this.game.addEvent(new EventDescriptor('HeroMax', this.name + ' is now max-band (level ' + newLvl + ')'));
            else if (hittingMid) this.game.addEvent(new EventDescriptor('HeroMid', this.name + ' is now mid-band  (level ' + newLvl + ')'));
            else this.game.addEvent(new EventDescriptor('HeroGainLvl', this.name + ' is now level ' + newLvl));
        }

        if (this._level === this.maxLevel) this.turnsTilCastUltimate = this.castsUltimateImmediately ? 0 : 1;
    }

    healAllDamage() {
        let damage = this.effective().damage;
        if (damage > 0) this.loseProperty('damage', damage);
    }

    newTurn() {
        if (this.turnsTilAvailable > 0) this.turnsTilAvailable--;
        if (this.level == this.maxLevel && this.turnsTilCastUltimate > 0) this.turnsTilCastUltimate--;
    }

    /** Note that for heroes, this makes them available immediately */
    resetCard() {
        super.resetCard();
        this.turnsTilAvailable = 0;
        this.turnsTilCastUltimate = this.castsUltimateImmediately ? 0 : 1;
        this.level = 1;
    }
}

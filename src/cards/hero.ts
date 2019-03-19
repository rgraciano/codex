import { Character, CardType } from './card';
import { ObjectMap } from '../game_server';
import { Game, EventDescriptor } from 'game';

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
            let damage = this.effective().damage;
            let healDamage = false;

            if (this._level < this.midLevel && newLvl >= this.midLevel && newLvl < this.maxLevel) {
                this.game.addEvent(new EventDescriptor('HeroMid', this.name + ' is now mid-level'));
                healDamage = true;
            } else if (this._level < this.maxLevel && newLvl == this.maxLevel) {
                this.game.addEvent(new EventDescriptor('HeroMax', this.name + ' is now max-level'));
                healDamage = true;
            } else {
                this.game.addEvent(new EventDescriptor('HeroGainLvl', this.name + ' is now level ' + newLvl));
            }

            if (healDamage && damage > 0) this.loseProperty('damage', damage);
        }

        this._level = newLvl;

        if (this._level === this.maxLevel) this.turnsTilCastUltimate = this.castsUltimateImmediately ? 0 : 1;
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

import { Card } from './card';
import { EventDescriptor } from '../game';

export interface AttacksHandler extends Card {
    onAttack(attacker: Card, defender: Card): EventDescriptor;
}

export interface UpkeepHandler extends Card {
    onUpkeep(): EventDescriptor;
}

/** Called when ANY card arrives, including this card */
export interface ArrivesHandler extends Card {
    onArrives(arrivingCard: Card): EventDescriptor;
}

/** For cards like Abomination or Nimble Fencer, they modify card status all the time, according to some selection criteria (eg Fencer modifies Virtuosos) */
export interface GlobalBonusHook extends Card {
    giveBonus(card: Card): EventDescriptor; // call this to give the bonus to a card; usually called when this arrives or something else arrives
    removeBonus(card: Card): EventDescriptor; // when card dies, use this to remove the bonus we applied earlier
}

/** When a card is about to die, this can trigger to do something (e.g. save it) */
export interface WouldDieHook extends Card {
    wouldDie(cardToDie: Card): EventDescriptor;
}

/** Called when ANY card dies, including this card */
export interface DiesHandler extends Card {
    onDies(dyingCard: Card): EventDescriptor;
}

/** Called when ANY card would be discarded, including this card */
export interface WouldDiscardHook extends Card {
    wouldDiscard(cardToDiscard: Card): EventDescriptor;
}

/** Called when ANY card leaves play, including this card */
export interface LeavesHandler extends Card {
    onLeaves(leavingCard: Card): EventDescriptor;
}

/** Called when ANY card attacks, including this card */
export interface AttacksHandler extends Card {
    onAttacks(attackingCard: Card): EventDescriptor;
}

export interface WorkersAreFreeAlteration extends Card {
    workersAreFree: boolean;
}

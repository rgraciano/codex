
import { Card, CardType } from './cards/cards';

/**
 * When something could cause in-game decisions and spiraling effects, we create a Trigger for the user to take action on that thing. 
 * 
 * A Trigger is:
 *      1) The thing that would do something on this event, usually a Card.
 *      2) A description of what it would do, so the user can see.
 *      3) Potentially a required target to do that thing.
 * 
 * Things that require triggers: 
 *      dies, leaves, arrives, attacks (hyperion), defends...
 * 
 */
export class Trigger {
    public description: string;
    public card: Card;
    public requiresTarget: boolean;
    public execute: () => (Trigger | null) = function() { return null; };

    constructor(description: string, card?: Card, execute?: () => (Trigger | null)) {
        if (execute)
            this.execute = execute;

        if (card)
            this.card = card;
        
        this.description = description;
    }
}

interface AttackHandler {
    onAttack(attacker: Card, defender: Card): Trigger;
}

interface GoldHandler {
    onCollectGold(goldAmount: number): Trigger;
}

//function processTriggers(targets: )
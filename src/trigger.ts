
import { Card, CardType } from './cards/card';

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
    descriptor: EventDescriptor;
    card: Card;
    requiresTarget: boolean;
    execute: () => (Trigger | null) = function() { return null; };

    constructor(descriptor: EventDescriptor, card?: Card, execute?: () => (Trigger | null)) {
        if (execute)
            this.execute = execute;

        if (card)
            this.card = card;
        
        this.descriptor = descriptor;
    }
}

/** Describes something that happened in the game, so the UI can tell the user later and perhaps do something visually  */
export class EventDescriptor {
    eventType: ServerEvent;

    initiatingCard: Card;
    impactedCards: Array<Card>;

    text: string;

    constructor(eventType: ServerEvent, text: string, initiatingCard: Card, impactedCards?: Array<Card>) {
        this.eventType = eventType;
        this.text = text;
        this.initiatingCard = initiatingCard;
    }
}
export type ServerEvent = 'ReadyCard' | 'UpkeepChoices';

interface AttackHandler {
    onAttack(attacker: Card, defender: Card): Trigger;
}

interface GoldHandler {
    onCollectGold(goldAmount: number): Trigger;
}

//function processTriggers(targets: )
import { EventDescriptor } from '../game';
import { ObjectMap } from '../game_server';
import { Ability } from './ability';
import { Card, CardType, Attributes } from './card';

export type SpellLevel = 'Tech 0' | 'Normal' | 'Ultimate';
export type SpellType = 'Burn' | 'Buff' | 'Debuff';
export type SpellLifecyle = 'Immediate' | 'MultipleChoice' | 'UntilEndOfTurn' | 'UntilNextTurn' | 'Ongoing' | 'Attachment';

/**
 * Spells are Cards with abilities. There are two types:
 *
 *    1) Spells with a Lifecycle type of 'Immediate' will need a Cast ability that will happen right away upon being called, or they
 *       need to register a bunch of other abilities into this.playerStageGroup, and the game will ask the user to choose which one they
 *       want to use.
 *
 *    2) Spells with a Lifecycle type of 'Attachment' will need an implementation of Attachment ability.  The game will call ability.use()
 *       to generate a list of targets (from ability.choices()), prompting the user for those targets, then ability.resolveChoice() to
 *       make the attachment happen with ability.attach().
 *
 *
 */
export abstract class Spell extends Card {
    readonly cardType: CardType = 'Spell';

    abstract readonly spellLevel: SpellLevel;
    abstract readonly spellLifecycle: SpellLifecyle;

    serialize(): ObjectMap {
        let pojo = super.serialize();
        pojo.spellLevel = this.spellLevel;
        pojo.spellLifecycle = this.spellLifecycle;
        return pojo;
    }

    deserializeExtra(pojo: ObjectMap): void {}

    /** This is overridden to calculate cost */
    effective(): Attributes {
        let attrs = super.effective();

        if (!this.controllerBoard.multiColor || !(this.techLevel == 0)) return attrs;

        // we only have Tech 0 spells for our chosen starting color, and if we're multi-color,
        // casting them with a different colored hero costs 1 extra gold
        let sameColorHeroes = this.game.getAllActiveCards(this.controllerBoard).filter(h => h.cardType == 'Hero' && h.color == this.color);

        if (sameColorHeroes.length === 0) attrs.cost++;

        return attrs;
    }
}

/**
 * User plays spell of type Immediate.  Game looks for castAbility and calls use() on it to continue.
 */
export abstract class ImmediateSpell extends Spell {
    abstract castAbility: Ability;
    spellLifecycle: SpellLifecyle;

    constructor(owner: number, controller?: number, cardId?: string) {
        super(owner, controller, cardId);
        this.spellLifecycle = 'Immediate';
    }
}

/**
 * User plays spell of type MultipleChoice.  Game looks for card.playStagingAbilityGroup, then presents the user with
 * multiple choice (only one can be selected) options representing all ability names on this card.  User chooses,
 * game looks up ability on this card, and calls its use() method.
 */
export abstract class MultipleChoiceSpell extends Spell {
    abstract ability1: Ability;
    abstract ability2: Ability;
    spellLifecycle: SpellLifecyle;

    constructor(owner: number, controller?: number, cardId?: string) {
        super(owner, controller, cardId);
        this.spellLifecycle = 'MultipleChoice';
    }
}

export abstract class AttachSpell extends Spell {
    abstract attachAbility: AttachAbility;
    spellLifecycle: SpellLifecyle;

    constructor(owner: number, controller?: number, cardId?: string) {
        super(owner, controller, cardId);
        this.spellLifecycle = 'Attachment';
    }
}

export abstract class OngoingSpell extends Spell {
    spellLifecycle: SpellLifecyle;

    constructor(owner: number, controller?: number, cardId?: string) {
        super(owner, controller, cardId);
        this.spellLifecycle = 'Ongoing';
    }

    abstract enterPlay(): void;
}

export abstract class UntilSpell extends OngoingSpell {}

/**
 * User plays spell with Attach Ability
 *
 * Game calls use() on ability, which calls this.choices() to get a list of possible targets.
 * Game asks user for which target.
 * Game calls resolveChoice() with the target.
 */
export abstract class AttachAbility extends Ability {
    constructor(card: Card) {
        super(card);
        this.name = 'Attach';
    }

    abstract choices(): Card[];

    attach(card: Card) {
        this.card.contains.push(card);
    }

    use() {
        super.use();
        this.choose(undefined, this.choices(), 1, 'Attach', true, true);
    }

    resolveChoice(cardOrBuildingId: string): EventDescriptor | undefined {
        this.attach(Card.idToCardMap.get(cardOrBuildingId));
        return undefined;
    }
}

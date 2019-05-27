import { Card, Attributes, TechLevel } from '../../card';
import { Spell, SpellLevel, SpellLifecyle, ImmediateSpell, OngoingSpell } from '../../spell';
import { WouldDieHook, ArrivesHandler, DiesHandler } from '../../handlers';
import { Game, EventDescriptor } from '../../../game';
import { CardApi } from '../../card_api';
import * as Color from '../../color';
import { Ability, DamageCharacterAbility, CreateTokensAbility, TargetingOptions } from '../../ability';
import { Dancer } from '../../tokens/Dancer';

export class Harmony extends OngoingSpell implements ArrivesHandler, DiesHandler {
    protected baseAttributes = new Attributes();

    color: Color.ColorName = 'Neutral';
    spec: Color.Spec = 'Finesse';
    flavorType: string = 'Buff';
    name: string = 'Harmony';
    importPath: string = './neutral/finesse';
    spellLevel: SpellLevel = 'Normal';
    techLevel: TechLevel = 0;
    spellLifecycle: SpellLifecyle = 'Ongoing';

    dancerTokenAbility: CreateTokensAbility;
    stopMusicAbility: StopMusicAbility;

    constructor(owner: number, controller?: number, cardId?: string) {
        super(owner, controller, cardId);
        this.baseAttributes.cost = 2;

        this.dancerTokenAbility = new CreateTokensAbility(this, 0, 'Dancer', 1);
        this.registerHandlerAbility(this.dancerTokenAbility);

        this.stopMusicAbility = new StopMusicAbility(this, new TargetingOptions());
        this.registerAbility(this.stopMusicAbility);
    }

    enterPlay() {}

    onArrives(card: Card): EventDescriptor {
        if (this.isYourCard(card) && card.cardType == 'Spell') {
            this.dancerTokenAbility.use();
            return new EventDescriptor('Info', 'Created 1 Dancer token');
        } else return undefined;
    }

    onDies(card: Card): EventDescriptor {
        if (this.isYourCard(card) && card.cardType == 'Hero' && card.flavorType == 'Finesse') CardApi.destroyCard(this);
        return new EventDescriptor('Info', 'Harmony ends, as Finesse Hero dies');
    }
}

export class StopMusicAbility extends Ability {
    name = 'Stop the Music';

    use() {
        let numDancers = 0;
        this.card.game.getAllActiveCards(this.card.controllerBoard).map(card => {
            if (card.name == 'Dancer') {
                numDancers++;
                (<Dancer>card).makeAngry();
            }
        });
        this.card.game.addEvent(new EventDescriptor('Info', 'Made ' + numDancers + ' dancers angry'));
        CardApi.destroyCard(this.card);
    }
}

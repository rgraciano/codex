import { Card } from '../cards/card';
import { Game } from '../game';
import { CardApi } from '../cards/card_api';
import { Action } from './phase';

export function abilityAction(cardId: string, abilityName: string, stagingAbility: boolean = false): void {
    let cardWithAbility = Card.idToCardMap.get(cardId);
    if (!cardWithAbility) throw new Error('Card ID ' + cardId + ' can not be found');

    let ability = stagingAbility ? cardWithAbility.stagingAbilityMap.get(abilityName) : cardWithAbility.abilityMap.get(abilityName);
    if (!ability) throw new Error('Could not find ability ' + abilityName + ' on card ' + cardWithAbility.name);

    if (!ability.canUse())
        throw new Error('Do not meet the requirements to use ability ' + abilityName + ' on card ' + cardWithAbility.name);

    ability.use();
}

export function chooseAbilityTargetChoice(game: Game, action: Action, card: Card, cardId: string) {
    let cardWithAbility = Card.idToCardMap.get(<string>action.extraState['cardWithAbility']);
    let ability = cardWithAbility.abilityMap.get(<string>action.extraState['abilityName']);

    if (!action.ifToResolve(cardId)) throw new Error('Invalid choice');

    /*if (none) {
        // if the user chose 'none', end phase and do not resolve
        game.addEvent(new EventDescriptor('NoneChosen', 'Player chose not to target anything'));
        game.phaseStack.endCurrentPhase();
        return false;
    }*/

    let destroyed = false;
    if (card && <boolean>action.extraState['usesTargetingRules']) {
        // subtract any resistance on the targeted card
        let eff = card.effective();
        cardWithAbility.controllerBoard.gold -= eff.resist;

        // some things die when targeted, eg illusions
        if (eff.diesWhenTargeted > 0) {
            CardApi.destroyCard(card);
            destroyed = true;
        }
    }

    // if we killed the thing we targeted, then the event no longer occurs. otherwise, resolve
    if (!destroyed) game.addEvent(ability.resolveChoice(cardId));

    return true;
}

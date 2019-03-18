import { Card } from '../cards/card';

export function abilityAction(cardId: string, abilityName: string, stagingAbility: boolean = false): void {
    let cardWithAbility = Card.idToCardMap.get(cardId);
    if (!cardWithAbility) throw new Error('Card ID ' + cardId + ' can not be found');

    let ability = stagingAbility ? cardWithAbility.stagingAbilityMap.get(abilityName) : cardWithAbility.abilityMap.get(abilityName);
    if (!ability) throw new Error('Could not find ability ' + abilityName + ' on card ' + cardWithAbility.name);

    if (!ability.canUse())
        throw new Error('Do not meet the requirements to use ability ' + abilityName + ' on card ' + cardWithAbility.name);

    ability.use();
}

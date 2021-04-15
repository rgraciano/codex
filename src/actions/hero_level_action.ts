import { Card, Hero } from '../cards/card';

export function heroLevelAction(cardId: string): void {
    let card = Card.idToCardMap.get(cardId);
    if (!card) throw new Error('Card ID ' + cardId + ' can not be found');

    if (!(card instanceof Hero)) {
        throw new Error('Only heroes can add levels');
    }

    if (card.controllerBoard.gold < 1) throw new Error('Not enough gold');

    let hero = <Hero>card;
    hero.level++;

    card.controllerBoard.gold--;
}

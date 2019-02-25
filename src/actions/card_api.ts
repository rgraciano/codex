
import { Game, EventDescriptor, RuneEvent } from '../game';
import { Card, Attributes, FlavorType, Character } from '../cards/card';
import { Phase, findCardsToResolve } from './phase';

/**
 * Everything in here is designed to be called by a card when something happens, e.g., something is made to arrive.
 */
export class CardApi {


    /** When you want something to arrive in play, use this */
    static cardArrivesInPlay(game: Game, card: Card): void {
        let boards = game.getBoardAndOpponentBoard();
        let board = boards[0];
        let opponentBoard = boards[1];
    
        // First, check if this card applies bonuses to other cards (possibly including or excluding self)
        // Third, check if this card GETS bonuses FROM other cards...

        // Second, enter the ARRIVES phase...
        game.phaseStack.addToStack(new Phase('Arrives', [ 'ArriveChoice' ]));

        let inPlayWithoutNewCard = board.inPlay;

        // Add the card to "in play"
        board.inPlay.push(card);

        // Add this card's "Arrives: ..." to the list of things to resolve
        findCardsToResolve(game, [ card ], 'onArrives');

        // Add any of my cards' "When <x> enters play, (do something)" to the list of things to resolve
        findCardsToResolve(game, inPlayWithoutNewCard.concat(board.getPatrolZoneAsArray(), board.effects), 'onAnotherArrives');

        // Add any of my opponents cards' "When an opponent's <x> enters play, (do something)" to the list of things to resolve.
        // I don't know any cards that actually do this, but implementing it here means it will technically be possible 
        findCardsToResolve(game, opponentBoard.inPlay.concat(opponentBoard.getPatrolZoneAsArray(), opponentBoard.effects), 'onOpponentArrives');

        // All done! If there's more than one event to resolve from the above, the user will be asked to choose the order.
    }

    /** Called when card text gives attributes to other cards with a flavor type. Example, Nimble Fencer: "Your Virtuosos gain haste" */
    static yourCardsOfFlavorTypeGainAttribute(card: Character, yourPlayerNumber: number, flavorType: FlavorType, attribute: keyof Attributes, numToGain = 1): EventDescriptor {
        return this.adjustPropertyOnYourCardsOfFlavorType(card, yourPlayerNumber, flavorType, attribute, 'add', numToGain);
    }

    /** Called when a card that gives attributes to other cards with a flavor type dies. Example, when Nimble Fencer dies, undoes "Your Virtuosos gain haste" */
    static yourCardsOfFlavorTypeLoseAttribute(card: Character, yourPlayerNumber: number, flavorType: FlavorType, attribute: keyof Attributes, numToGain = 1): EventDescriptor {
        return this.adjustPropertyOnYourCardsOfFlavorType(card, yourPlayerNumber, flavorType, attribute, 'subtract', numToGain);
    }

    private static adjustPropertyOnYourCardsOfFlavorType(card: Character, yourPlayerNumber: number, flavorType: FlavorType, attribute: keyof Attributes, addOrSubtract: ('add' | 'subtract'), numToGain: number): EventDescriptor {
        if (yourPlayerNumber === card.controller && card.flavorType === flavorType)
            return (addOrSubtract == 'add') ? CardApi.gainProperty(card, attribute, numToGain) : CardApi.loseProperty(card, attribute, numToGain);
        else 
            return undefined;
    }

    /** Gains something like 'haste' or 'frenzy' */
    static gainProperty(card: Card, property: keyof Attributes, numToGain = 1) {
        return CardApi.adjustProperty(card, numToGain, property, 'add');
    }

    /** Loses something like 'haste' or 'frenzy' */
    static loseProperty(card: Card, property: keyof Attributes,  numToLose = 1) {
        return CardApi.adjustProperty(card, numToLose, property, 'subtract');
    }

    /** Use to take a rune of any type off a card. Handles all corresponding effects */
    static loseMarkerOrRune(card: Card, numRunes: number, runeProperty: keyof Attributes) {
        return CardApi.adjustProperty(card, numRunes, runeProperty, 'add');
    }

    /** Use to put a rune of any type on a card. Handles all corresponding effects */
    static gainMarkerOrRune(card:Card, numRunes: number, runeProperty: keyof Attributes) {
        return CardApi.adjustProperty(card, numRunes, runeProperty, 'subtract');
    }

    private static adjustProperty(card: Card, numToAdjust: number, runeProperty: keyof Attributes, addOrSubtract: ('add' | 'subtract')) {
        let add = addOrSubtract == 'add';

        if (add)
            card.attributeModifiers[runeProperty] += numToAdjust;
        else {
            card.attributeModifiers[runeProperty] -= numToAdjust;

            if (card.attributeModifiers[runeProperty] < 0)
                card.attributeModifiers[runeProperty] = 0;
        }

        let desc: string = (add ? ' gained ' : ' removed ') + numToAdjust + " ";

        switch (runeProperty) {
            case 'timeRunes':
                desc += 'time runes';
                break;
            case 'damage':
                desc += 'damage';
                break;
            case 'plusOneOne':
                desc += '+1/+1';
                break;
            case 'minusOneOne':
                desc += '-1/-1';
                break;
            case 'featherRunes':
                if (add)
                    card.attributeModifiers.flying++;

                if (card.attributeModifiers.flying > 0)
                    desc += 'feather and is now flying';
                else
                    desc += 'feather and is no longer flying';
                break;
            case 'crumblingRunes':
                if (add)
                    desc += 'crumbling rune and can now die';
                else   
                    desc += 'crumbling rune';
                break;
            default:
                throw new Error('Tried to gain marker or rune but ' + runeProperty + ' was not recognized');
        }

        return new EventDescriptor(<RuneEvent>runeProperty, this.name + desc, { cardId: card.cardId, gained: add, numChanged: numToAdjust });
    }


}
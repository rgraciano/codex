import { abilityAction } from './ability_action';
import { Game } from '../game';
import { CardApi } from '../cards/card_api';
import { Card } from '../cards/card';

/**
 * When a card is played, the game first stages it into the "staging area". It then looks for "abilities"
 * on the card that are flagged as "playStaging", and presents them as options for the user to execute BEFORE
 * the card is played.  For example, Boost is one option.  Another option might be Oathkeeper's choice to do
 * one thing or another thing, or Murkwood Allies asking you which thing you intend to do.
 *
 * The game lets the user choose ONE of the things in the list, and then moves on.
 */
export function playStagingAbilityAction(game: Game, cardId: string, abilityName: string): void {
    // remember which phase we're in. must be 'PlayStagingAbility' or we would not be here
    let phase = game.phaseStack.topOfStack();

    // the user picked an ability. does the exact same thing abilityAction does, so use that action to resolve
    abilityAction(cardId, abilityName, true);

    // we can only choose ONE thing before play, so now that we've done that thing, we remove this phase.
    // thus, we'll flag this phase for removal on phase cleanup.
    phase.endThisPhase = true;
    CardApi.leaveStagingArea(Card.idToCardMap.get(cardId), game.getBoardAndOpponentBoard()[0].playStagingArea);
}

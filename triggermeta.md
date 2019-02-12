The following are current known categories of triggers/card attributes and meta-commentary about how they might be handled:

* <B>Attributes</B> (Swift strike, frenzy, haste, invisible, hero/unit, etc.) - these are probably booleans that a unit either has or doesn't, which processing logic can easily check when resolving a battle or checking if a trigger applies. Some attributes might be set by buffs, so the buff/debuff queue of a card would be checked first, then the default attribute checked later if no applicable buffs/debuffs were found. (Is there a situation where a card could have e.g. Haste added and removed by multiple card effects? If so, how is that resolved?)
* <b>Type</b> - Each card seems to have only one type (Buff, Debuff, Beast, Flagbearer, Cute Animal, etc.). These are often checked by other triggers to determine what triggers might apply, but seem to be static for the lifetime of each card. Probably a read-only enumeration is good for these.
* <b>Arrival triggers</b> (Arrives, Haste, Channeled) - these are things that happen when the card is played. Probably all spells are processed with arrival triggers, which would include a discard step at the end.
* <b>Departure triggers</b> (Dies, Sacrificed, Any Unit Dies, "Stop the Music") - these are things that happen when the card leaves play in various ways, or when other cards leave play. Any 'any unit dies' card probably registers itself in a queue that also gets processed on every departure trigger, and removes itself from queues when it leaves play (i.e. a subscriber to a 'someone died' Kafka topic).
* <b>Type triggers</b> (Virtuosos get +2/+1, Virtuosos have Haste) - When a card with a type trigger enters play, it could add the bonus attribute to every card with the tag in the entire game (in play, in hand, in discard, in codex), then remove it when it left play. Some attributes stack, and this is fine. Others, like Haste, don't stack, but it does no harm to have multiple copies of Haste - logic would just break out of any single stack if Haste was found from any buff and not continue processing that trigger question. (See above question about attributes, though.)
* <b>Targetting triggers</b> (When Targeted, Flagbearer, Resist) - These triggers process when a unit is targeted or when a player attempts to target other units. Cards with these triggers could register themselves in a targeting queue that must be processed when the opponent attempts to target them, and remove themselves again when they leave play. One queue would attach to the card itself, and one would be a global queue that could handle the Taunt slot, patrollers, and Flagbearers.
* <b>Upkeep triggers</b> - These triggers process in a queue that cards could register themselves for. The Upkeep queue might be processed in any order and could just be presented to the player to sort if the effects change the state of the Upkeep queue itself while processing. If there are few enough permutations, the outcomes of each order could just be presented to the player to choose the best of (a player might choose a UI config option for obviously bad choices to not be presented at all).
* <b>End of turn triggers</b> (including Ephemeral) - Same as upkeep triggers, but processed at the end of a player's turn.
* <b>Temporary vs. Permanent vs. removable buffs/debuffs</b> - a temporary buff could add a buff to a card and a 'remove me' trigger to the end of turn queue. A permanent buff would simply not register in the end of turn queue. A removable buff would just have a way to target it for removal by some other ability. A running total of attack/shield/health could be kept based on the sum total of all buffs to save recomputing the result at runtime (might matter for optimizing AI later).
import { Card, Character, Attributes } from '../cards/card';
import { Phase, Action } from './phase';
import { EventDescriptor, Game } from '../game';
import { CardApi } from '../cards/card_api';
import { StringMap } from '../game_server';
import { BoardBuilding, Board, PatrolZone } from '../board';
import { UnstoppableWhenAttacking } from '../cards/handlers';

function getAttackerFromId(attackerId: string): Character {
    // choose attacker
    let card = Card.idToCardMap.get(attackerId);

    // must be a hero, must be a unit
    if (!card || !(card.cardType == 'Hero' || card.cardType == 'Unit')) {
        throw new Error('Invalid attacker: ' + attackerId);
    }

    return <Character>card;
}

/** First phase of an attack: Choose the attacker, validate they can attack, and process all onAttacks handlers */
export function attackAction(attackerId: string) {
    let attacker = getAttackerFromId(attackerId);
    let attrs: Attributes = attacker.effective();
    let game = attacker.game;

    // verify attacker is alive
    if (!game.cardIsInPlay(attacker.controllerBoard, attacker)) {
        throw new Error('Attacker must be in the "In Play" space');
    }

    // verify this attacker is able to attack
    if (attrs.exhausted) throw new Error('Can not attack with exhausted card ' + attackerId);

    if (attrs.haveAttackedThisTurn < attacker.attacksPerTurn)
        // cards like Rampaging Elephant set this to 2. cards that can't attack set it to 0
        throw new Error('This card has already attacked once this turn');

    // mark that we have attacked, so we can't attack again
    attacker.attributeModifiers.haveAttackedThisTurn++;

    // exhaust card, unless we have readiness, or if we have attacks left
    if (!attrs.readiness || attacker.attributeModifiers.haveAttackedThisTurn < attacker.attacksPerTurn)
        attacker.attributeModifiers.exhausted++;

    // enter phase that is empty, to choose the target of the attack. give it one resolveId (attacker) so that it will auto-execute
    // when the attack handlers are all done
    let prepTargetsAction = new Action('PrepareAttackTargets', {
        chooseNumber: 1,
        mustChooseAll: true,
        canChooseTargetsMoreThanOnce: false
    });
    prepTargetsAction.clearOnEmpty = false;
    prepTargetsAction.addIds([attacker.cardId]);
    game.phaseStack.addToStack(new Phase([prepTargetsAction]));

    // enter phase for attack handlers
    // fire attacks, obliterate handlers. cards may modify attacks, e.g. safe attacking, giving temporary 'while attacking' stats
    // .. how to handle armor? we need to track armor in the duration of a turn
    CardApi.trigger(game, 'AttacksChoice', 'onAttacks', 'AllActive', { attackingCardId: attacker.cardId });
}

/** Second phase of an attack: prepare a list of possible defenders and ask the user to choose their attack target */
export function prepareAttackTargetsAction(attackerId: string, mustChooseThisDefender: Card = undefined) {
    let attacker: Character = getAttackerFromId(attackerId);
    let game = attacker.game;

    // First, if this phase is being auto-resolved, then let's end it
    if (game.phaseStack.topOfStack().actions.find(action => action.name == 'PrepareAttackTargets')) game.phaseStack.endCurrentPhase();

    // check if attacker still alive; if not, we can simply exit this phase indicating that attacker is dead and therefore attack has stopped
    if (!game.cardIsInPlay(attacker.controllerBoard, attacker)) {
        game.addEvent(
            new EventDescriptor('AttackComplete', 'Attacker is no longer in play, so the attack is now completed', {
                attackerId: attackerId
            })
        );
        return;
    }

    // prepare a list of possible defenders and return them to the user for selection. note buildings can be attacked as well.
    // this is where we account for stealth, flying, unstoppable, invisible, & tower

    let attackerAttrs = attacker.effective();

    // first - are we unstoppable? if so, go bananas
    if (attackerAttrs.unstoppable) {
        sendAllTargetsAreValid(attacker, mustChooseThisDefender);
        return;
    }

    // second - are we stealth or invisible, and is there a detector that can override that status (eg tower)?
    // note this is not where we check temporary stealth, e.g. Stalking Tiger. that comes later
    if ((attackerAttrs.stealth || attackerAttrs.invisible) && !attackerAttrs.towerRevealedThisTurn) {
        let unstoppable = true;

        // if the opponent has a card working as a detector...
        if (game.getAllActiveCards(attacker.oppControllerBoard).filter(card => card.effective().detector).length === 0) unstoppable = false;

        // if the opponent has a tower that can detect the attacker
        let addOn = attacker.oppControllerBoard.addOn;
        if (addOn && addOn.addOnType === 'Tower' && addOn.towerRevealedThisTurn === false) {
            unstoppable = false;
            addOn.towerRevealedThisTurn = true;
            attacker.gainProperty('towerRevealedThisTurn');
            game.addEvent(new EventDescriptor('TowerReveal', 'Tower revealed ' + attacker.name, { attackerId: attackerId }));
        }

        if (unstoppable) {
            sendAllTargetsAreValid(attacker, mustChooseThisDefender);
            return;
        }
    }

    // check if any patrollers can stop us...
    let patrollersAbleToBlock = attacker.oppControllerBoard
        .getPatrolZoneAsArray()
        .filter(patroller => checkPatrollerCanBlockAttacker(attacker, attackerAttrs, patroller));

    // if nobody can block, then the attacker can choose to attack any valid target
    if (patrollersAbleToBlock.length === 0) {
        sendAllTargetsAreValid(attacker, mustChooseThisDefender);
        return;
    }

    // if a patroller can block, then return the possible patrollers we can attack
    let action = makeDefenderAction(attacker);
    game.phaseStack.addToStack(new Phase([action]));

    // This is a tricky situation... if we are stealth only when attacking a specific thing, then we have to return
    // all of that thing type as a potential target.  The user then may choose that thing type in the next action,
    // in which case we have to check if there's a Detector in play, and if there is then the action will set towerRevealedThisTurn
    // to true and it will enter prepareAttackTargetsAction AGAIN, having them select targets again.
    let stealthWhenAttackingUnits = CardApi.hookOrAlterationSingleValue(
        CardApi.hookOrAlteration(game, 'alterStealthWhenAttackingUnits', [attacker], 'None', attacker),
        false
    );
    if (stealthWhenAttackingUnits && !attacker.effective().towerRevealedThisTurn) {
        action.addIds(game.getAllAttackableIdsOfType(attacker, attacker.oppControllerBoard, 'Unit'));
    }

    // check to see if we have an alteration that allows us to skip patrollers when attacking specific targets.
    // for example, "unstoppable when attacking a base".
    let unstoppableFor = CardApi.hookOrAlterationSingleValue(
        CardApi.hookOrAlteration(game, 'alterUnstoppable', [attacker], 'None', attacker),
        <UnstoppableWhenAttacking>'None'
    );

    // if we're unstoppable when attacking the opponent's base, add the base to the list of targets
    if (unstoppableFor == 'Base' && checkBuildingIsAttackable(attacker, attacker.oppControllerBoard.base)) {
        action.addIds([attacker.oppControllerBoard.base.name]);
    } else if (unstoppableFor == 'Building') {
        for (let bldg of attacker.oppControllerBoard.buildings) {
            if (checkBuildingIsAttackable(attacker, bldg)) action.addIds([bldg.name]);
        }

        action.addIds(game.getAllAttackableIdsOfType(attacker, attacker.oppControllerBoard, 'Building'));
    } else if (unstoppableFor == 'Heroes') {
        action.addIds(game.getAllAttackableIdsOfType(attacker, attacker.oppControllerBoard, 'Hero'));
    } else if (unstoppableFor == 'Everything') {
        sendAllTargetsAreValid(attacker, mustChooseThisDefender);
        return;
    } else if (unstoppableFor == 'SkipsTech0Patrollers') {
        patrollersAbleToBlock = patrollersAbleToBlock.filter(defender => defender.cardType != 'Unit' || defender.techLevel != 0);
    } else if (unstoppableFor == 'Units') {
        patrollersAbleToBlock = patrollersAbleToBlock.filter(defender => defender.cardType != 'Unit');
    }

    // check again for patrollers, as now the unattackable alteration may have removed them
    if (patrollersAbleToBlock.length == 0) {
        sendAllTargetsAreValid(attacker, mustChooseThisDefender);
        return;
    }

    // no sneaking by the patrollers. let's look for a squad leader first
    if (patrollersAbleToBlock.find(patroller => patroller === attacker.oppControllerBoard.patrolZone.squadLeader)) {
        action.addIds([attacker.oppControllerBoard.patrolZone.squadLeader.cardId]);
        game.addEvent(
            new EventDescriptor('PossibleAttackTargets', 'The squad leader must be attacked first', {
                buldings: false,
                validCardTargetIds: [attacker.oppControllerBoard.patrolZone.squadLeader.cardId]
            })
        );
    }
    // if no squad leader can block, all patrollers are fair game
    else {
        let patrollerIds = patrollersAbleToBlock.map(card => card.cardId);
        if (mustChooseThisDefender && patrollerIds.find(thisPatrollerId => thisPatrollerId == mustChooseThisDefender.cardId))
            action.addIds([mustChooseThisDefender.cardId]);
        else action.addIds(patrollerIds);
        game.addEvent(
            new EventDescriptor('PossibleAttackTargets', 'A patroller must be attacked first', {
                buildings: true,
                validCardTargetIds: patrollerIds
            })
        );
    }
}

export function prepareAttackTargetsChoice(action: Action, choiceValue: string, card: Card, context: StringMap): boolean {
    if (action.ifToResolve(choiceValue)) throw new Error('Invalid choice');

    let phase = card.game.phaseStack.topOfStack();
    context.building ? attackChosenTarget(card, context.building) : attackChosenTarget(card, undefined, context.validCardTargetId);
    phase.endThisPhase = true;

    return true;
}

function sendAllTargetsAreValid(attacker: Character, mustChooseThisDefender: Card) {
    let game = attacker.game;
    let action = makeDefenderAction(attacker);
    game.phaseStack.addToStack(new Phase([action]));

    if (mustChooseThisDefender) {
        action.addIds([mustChooseThisDefender.cardId]);
        return;
    }

    let defenderCards = game.getAllActiveCards(attacker.oppControllerBoard);
    let defenderAttackableCards = game.getAllAttackableCards(attacker, defenderCards);
    let defenderIds = defenderAttackableCards.map(localCard => localCard.cardId);

    action.addIds(defenderIds);

    for (let bldg of attacker.oppControllerBoard.buildings) sendBuildingTargetIfValid(attacker, bldg, action);

    game.addEvent(
        new EventDescriptor('PossibleAttackTargets', 'No blockers are available. All attack destinations are valid', {
            buildings: true,
            validCardTargetIds: [defenderIds]
        })
    );
}

function makeDefenderAction(attacker: Character): Action {
    let action = new Action('DefenderChoice', { chooseNumber: 1, mustChooseAll: false, canChooseTargetsMoreThanOnce: false });
    action.extraState.attackingCardId = attacker.cardId;
    return action;
}

function sendBuildingTargetIfValid(attacker: Character, boardBuilding: BoardBuilding, action: Action) {
    if (checkBuildingIsAttackable(attacker, boardBuilding)) action.addIds([boardBuilding.name]);
}

function checkBuildingIsAttackable(attacker: Character, boardBuilding: BoardBuilding): boolean {
    let hookResults = CardApi.hookOrAlteration(attacker.game, 'alterCanAttackBuildings', [attacker, boardBuilding], 'AllActive');
    let preventedFromAttacking =
        hookResults.length > 0
            ? hookResults.reduce((previousValue: any, currentValue: any) => !previousValue || !currentValue, true)
            : false;
    return !preventedFromAttacking && boardBuilding.isActive();
}

/** Only takes into account flying & not flying. Stealth, invisible, etc is handled elsewhere */
function checkPatrollerCanBlockAttacker(attacker: Card, attackerAttrs: Attributes, patroller: Card): boolean {
    if (!patroller) return false;

    if (patroller.game.getAllAttackableCards(attacker, [patroller], true).length <= 0) return false;

    let patrollerAttrs = patroller.effective();

    if (attackerAttrs.flying && patrollerAttrs.flying) return true;

    if (!attackerAttrs.flying && !patrollerAttrs.flying) return true;

    return false;
}

export function attackChosenTarget(attacker: Card, building?: string, validCardTargetId?: string) {
    // check what was chosen. if it's a card then it should be in the resolveMap.  if it's a building then it should be not destroyed
    if (attacker.cardType != 'Unit' && attacker.cardType != 'Hero') {
        throw new Error('Attacker must be a character');
    }
    let attackChar = <Character>attacker;

    if (building) {
        let boardBuilding: BoardBuilding = attacker.opponentBoard.getBuildingByName(building);

        if (!boardBuilding.built || boardBuilding.constructionInProgress || boardBuilding.destroyed)
            throw new Error(boardBuilding.name + ' is not attackable');

        attackBuilding(attackChar, boardBuilding);
    } else {
        let card = Card.idToCardMap.get(validCardTargetId);
        if (!card) throw new Error('Could not find card ' + validCardTargetId);
        attackCard(attackChar, card);
    }
}

function attackBuilding(attacker: Character, building: BoardBuilding) {
    let game = attacker.game;

    /* 1) have to check if building can actually be damaged, as it could be flying or it could be unattackable due to a card effect
     *    1a- call a hook that checks whether or not buildings are attackable? also put this in card targeting rules
     *        alterCanAttackBuildings(cardAttacking: Card, buildingDefender: BoardBuilding): boolean;
     */
    if (!checkBuildingIsAttackable(attacker, building)) {
        throw new Error();
    }

    /* 2) deal dmg to building. use alterCombatDamage */
    let modifiedDamage = CardApi.hookOrAlteration(attacker.game, 'alterCombatDamage', [attacker, undefined, building], 'AllActive').reduce(
        (acc: number, cur: number) => acc + cur,
        0
    );

    game.addEvent(building.damage(attacker.allAttack + modifiedDamage, attacker));

    game.addEvents(CardApi.hookOrAlteration(game, 'dealCombatDamage', [attacker, undefined, building], 'AllActive'));

    /* 3) if flying, take dmg from anti-air */
    processAntiAirDamage(attacker);

    /* 4) if tower, take dmg from that */
    processTowerDamage(attacker);
}

function attackCard(attacker: Card, defender: Card) {
    let defenderBoard = defender.controllerBoard;
    let tower = defenderBoard.addOn.isActive() && defenderBoard.addOn.addOnType == 'Tower' ? defenderBoard.addOn : undefined;

    let game = attacker.game;

    // this is for the strange scenario in which Stalking Tiger ('stealth when attacking a unit') chose a unit, is attacking it,
    // but has now been revealed by an opponent tower and now has to go select another defender.
    if (defender.cardType == 'Unit') {
        if (
            CardApi.hookOrAlterationSingleValue(
                CardApi.hookOrAlteration(attacker.game, 'alterStealthWhenAttackingUnits', [attacker], 'None', attacker),
                false
            ) &&
            !attacker.effective().towerRevealedThisTurn
        ) {
            if (tower && !tower.towerRevealedThisTurn) {
                attacker.game.addEvent(
                    new EventDescriptor('TowerReveal', attacker.name + ' stealth attacked a unit and was revealed by the tower.')
                );

                tower.towerRevealedThisTurn = true;
                attacker.attributeModifiers.towerRevealedThisTurn = 1;
                prepareAttackTargetsAction(attacker.cardId, defender);
                return;
            }
        }
    }

    processTowerDamage(attacker);

    // Entering a new phase, in which we'll put all concurrent events for resolution
    let combatDamagePhase = new Phase([]);
    game.phaseStack.addToStack(combatDamagePhase);

    // Before we deal damage, let's remember where the card we were attacking was residing...
    let defenderPatrolSlot: keyof PatrolZone = undefined;

    for (let patrolSlot in defenderBoard.patrolZone) {
        if (defenderBoard.patrolZone[patrolSlot] == defender) {
            defenderPatrolSlot = patrolSlot;
        }
    }

    // Attacker and defender deal combat damage to one another. Accounts for swift strike. Note things may die here,
    // and will move to the discard pile or be removed from game accordingly
    let excessDamage: number = 0;
    if (defender.effective().swiftStrike > 0 && attacker.effective().swiftStrike < 1) excessDamage = combatDamage(defender, attacker, true);
    else excessDamage = combatDamage(attacker, defender);

    processAntiAirDamage(attacker, defenderPatrolSlot);

    let attackerEffective = attacker.effective();

    // If overpower is a possibility, then we'll have to let the user choose when to activate it amidst everything else that's happening
    if (excessDamage > 0 && attackerEffective.overpower) {
        let overpowerAction = new Action('Overpower', { canChooseTargetsMoreThanOnce: false, chooseNumber: 1, mustChooseAll: false });
        combatDamagePhase.actions.push(overpowerAction);
        overpowerAction.addIds([attacker.cardId]);
    }

    // Sparkshot just happens immediately. It isn't interruptable and it can't be redirected, so we might as well do it right away
    if (attackerEffective.sparkshot && defenderPatrolSlot) {
        let dealSparkDmg = (card: Card) => dealCombatDamage(game, attacker, card, 'sparkshot', 1, false);

        switch (defenderPatrolSlot) {
            case 'squadLeader':
                dealSparkDmg(defenderBoard.patrolZone.elite);
                break;
            case 'elite':
                dealSparkDmg(defenderBoard.patrolZone.squadLeader);
                dealSparkDmg(defenderBoard.patrolZone.scavenger);
                break;
            case 'scavenger':
                dealSparkDmg(defenderBoard.patrolZone.elite);
                dealSparkDmg(defenderBoard.patrolZone.technician);
                break;
            case 'technician':
                dealSparkDmg(defenderBoard.patrolZone.scavenger);
                dealSparkDmg(defenderBoard.patrolZone.lookout);
                break;
            case 'lookout':
                dealSparkDmg(defenderBoard.patrolZone.technician);
                break;
        }
    }
}

function processTowerDamage(attacker: Card) {
    // accounting for tower, which always hits the attacker. no escaping it
    if (attacker.oppControllerBoard.addOn.isActive() && attacker.oppControllerBoard.addOn.name == 'Tower') {
        let [armorDamaged, physicalDamage] = dealDamageToCard(1, attacker);
        let damageType = armorDamaged > 0 ? 'armor' : 'physical';
        attacker.game.addEvent(new EventDescriptor('TowerDamage', 'Tower did 1 ' + damageType + ' damage to ' + attacker.name));
    }
}

function processAntiAirDamage(attacker: Card, defenderPatrolSlot?: keyof PatrolZone) {
    let attackerEffective = attacker.effective();
    let defenderBoard = attacker.oppControllerBoard;
    let game = attacker.game;

    // Anti-air hits us if we're flying over a patroller w/ anti-air attribute
    if (attackerEffective.flying) {
        // attacking a patroller, so squad leader with AA can take a shot at us
        if (
            defenderPatrolSlot &&
            defenderPatrolSlot != 'squadLeader' &&
            defenderBoard.patrolZone.squadLeader &&
            defenderBoard.patrolZone.squadLeader.effective().antiAir
        ) {
            dealCombatDamage(game, defenderBoard.patrolZone.squadLeader, attacker, 'anti-air');
        }
        // attacking a non-patroller, so any patroller with AA can take a shot at us
        else if (!defenderPatrolSlot) {
            for (let patroller of defenderBoard.getPatrolZoneAsArray()) {
                if (patroller) {
                    let eff = patroller.effective();

                    if (eff.antiAir && patroller.allAttack) {
                        dealCombatDamage(game, patroller, attacker, 'anti-air');
                    }
                }
            }
        }
    }
}

/** Removes armor, deals damage to card, and returns the amount of armor damage done and amount of real damage done */
function dealDamageToCard(attemptedDamage: number, receiver: Card, dealDamageAsMinus11 = false): [number, number] {
    // Always damage armor first
    let receiverEffective = receiver.effective();

    let armorRemaining = receiverEffective.armor - receiverEffective.damageToArmor;

    let armorDamaged = armorRemaining > attemptedDamage ? attemptedDamage : armorRemaining;

    let damageDone = attemptedDamage - armorDamaged;

    if (receiver.game.getAllActiveCards().includes(receiver)) {
        receiver.gainProperty('damageToArmor', armorDamaged);

        if (dealDamageAsMinus11) receiver.gainProperty('minusOneOne', damageDone);
        else receiver.gainProperty('damage', damageDone);
    }

    return [armorDamaged, damageDone];
}

function dealCombatDamage(game: Game, striker: Card, receiver: Card, adjective = '', specificDamage = 0, triggerHook = true) {
    if (!striker || !receiver) return;

    let attemptedDamage = specificDamage ? specificDamage : striker.allAttack;
    let dealsDamageAsMinus11 = striker.effective().dealsDamageAsMinus11 > 0;

    let [armorDamaged, damageDone] = dealDamageToCard(attemptedDamage, receiver, dealsDamageAsMinus11);

    let descText = striker.name + ' did ';
    if (armorDamaged > 0) descText += armorDamaged + ' armor damage';
    if (damageDone > 0) {
        if (armorDamaged > 0) descText += ' and';
        descText += damageDone;
        if (adjective) descText += ' ' + adjective;
        if (dealsDamageAsMinus11) descText += ' -1/-1 runes';
        else descText += ' physical damage';
    }
    descText += ' to ' + receiver.name;

    game.addEvent(new EventDescriptor('CombatDamage', descText));

    if (triggerHook) game.addEvents(CardApi.hookOrAlteration(game, 'dealCombatDamage', [striker, receiver], 'AllActive'));
}

function combatResolveDamage(striker: Card, receiver: Card, swiftStrike = false): [number, boolean] {
    let game = striker.game;
    let excessDamage = 0;
    let destroyed = false;

    dealCombatDamage(game, striker, receiver, swiftStrike ? 'swift strike' : '');

    if (receiver.shouldDestroy()) {
        excessDamage = receiver.effective().damage - receiver.allHealth;

        // if swift strike was used, then we destroy the card right now
        // note the card could be saved by something like soul stone
        if (swiftStrike) {
            game.addEvent(new EventDescriptor('WouldDie', receiver.name + ' would die from swift strike damage received'));
            destroyed = CardApi.destroyCard(receiver);
        }
    }

    return [excessDamage, destroyed];
}

function combatDamage(striker: Card, receiver: Card, returnExcessForReceiver = false): number {
    let attemptedSwiftStrike = false;
    let strikerExcessDamage = 0,
        receiverExcessDamage = 0;
    let receiverDestroyed = false;

    if (striker.effective().swiftStrike && !receiver.effective().swiftStrike) attemptedSwiftStrike = true;

    [strikerExcessDamage, receiverDestroyed] = combatResolveDamage(striker, receiver, attemptedSwiftStrike);

    if (!attemptedSwiftStrike || !receiverDestroyed) [receiverExcessDamage] = combatResolveDamage(receiver, striker);

    // note processDeath could save the card from death, e.g. in the instance a unit is wearing a Soul Stone..
    // gotta manage this somehow... trigger death to process?

    return returnExcessForReceiver ? receiverExcessDamage : strikerExcessDamage;
}

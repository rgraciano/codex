import { Card, Character, Attributes } from '../cards/card';
import { Phase, Action } from './phase';
import { EventDescriptor, Game } from '../game';
import { CardApi } from '../cards/card_api';
import { StringMap } from '../game_server';
import { BoardBuilding, Board } from '../board';
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
    let prepTargetsAction = new Action('PrepareAttackTargets', false, 1, true, false);
    prepTargetsAction.idsToResolve.push(attacker.cardId);
    game.phaseStack.addToStack(new Phase([prepTargetsAction]));

    // enter phase for attack handlers
    // fire attacks, obliterate handlers. cards may modify attacks, e.g. safe attacking, giving temporary 'while attacking' stats
    // .. how to handle armor? we need to track armor in the duration of a turn
    CardApi.trigger(game, 'AttacksChoice', 'onAttacks', 'AllActive', { attackingCardId: attacker.cardId });
}

/** Second phase of an attack: prepare a list of possible defenders and ask the user to choose their attack target */
export function prepareAttackTargetsAction(attackerId: string) {
    let attacker: Character = getAttackerFromId(attackerId);
    let game = attacker.game;

    // check if attacker still alive; if not, we can simply exit this phase indicating that attacker is dead and therefore attack has stopped
    if (!game.cardIsInPlay(attacker.controllerBoard, attacker)) {
        game.phaseStack.endCurrentPhase();
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
        sendAllTargetsAreValid(attacker);
        return;
    }

    // second - are we stealth or invisible, and is there a detector that can override that status (eg tower)?
    // note this is not where we check temporary stealth, e.g. Stalking Tiger. that comes later
    if ((attackerAttrs.stealth || attackerAttrs.invisible) && !attackerAttrs.towerRevealedThisTurn) {
        let unstoppable = true;

        // if the opponent has a card working as a detector...
        if (game.getAllActiveCards(attacker.oppositionalControllerBoard).filter(card => card.effective().detector).length === 0)
            unstoppable = false;

        // if the opponent has a tower that can detect the attacker
        let addOn = attacker.oppositionalControllerBoard.addOn;
        if (addOn && addOn.addOnType === 'Tower' && addOn.towerRevealedThisTurn === false) {
            unstoppable = false;
            addOn.towerRevealedThisTurn = true;
            attacker.gainProperty('towerRevealedThisTurn');
            game.addEvent(new EventDescriptor('TowerDetected', 'Tower detected ' + attacker.name, { attackerId: attackerId }));
        }

        if (unstoppable) {
            sendAllTargetsAreValid(attacker);
            return;
        }
    }

    // check if any patrollers can stop us...
    let patrollersAbleToBlock = attacker.oppositionalControllerBoard
        .getPatrolZoneAsArray()
        .filter(patroller => checkPatrollerCanBlockAttacker(attacker, attackerAttrs, patroller));

    // if nobody can block, then the attacker can choose to attack any valid target
    if (patrollersAbleToBlock.length === 0) {
        sendAllTargetsAreValid(attacker);
        return;
    }

    //

    // if a patroller can block, then return the possible patrollers we can attack
    let action = new Action('DefenderChoice', false, 1, true, false);
    game.phaseStack.addToStack(new Phase([action]));

    // check to see if we have an alteration that allows us to skip patrollers when attacking specific targets.
    // for example, "unstoppable when attacking a base".
    let unstoppableForAry = <UnstoppableWhenAttacking[]>CardApi.hookOrAlteration(game, 'alterUnstoppable', [attacker], 'None', attacker);
    let unstoppableFor: UnstoppableWhenAttacking = 'None';
    if (unstoppableForAry && unstoppableForAry.length > 0) unstoppableFor = unstoppableForAry[0];

    // if we're unstoppable when attacking the opponent's base, add the base to the list of targets
    if (unstoppableFor == 'Base' && checkBuildingIsAttackable(attacker, attacker.oppositionalControllerBoard.base)) {
        action.idsToResolve.push(attacker.oppositionalControllerBoard.base.name);
    } else if (unstoppableFor == 'Building') {
        let oppBoard = attacker.oppositionalControllerBoard;

        let freeAttack = (bldg: BoardBuilding) => {
            if (checkBuildingIsAttackable(attacker, bldg)) action.idsToResolve.push(bldg.name);
        };
        freeAttack(oppBoard.base);
        freeAttack(oppBoard.tech1);
        freeAttack(oppBoard.tech2);
        freeAttack(oppBoard.tech3);
        freeAttack(oppBoard.addOn);

        action.idsToResolve.push(
            ...game
                .getAllAttackableCards(attacker, game.getAllActiveCards(oppBoard))
                .filter(card => card.cardType == 'Building')
                .map(card => card.cardId)
        );
    } else if (unstoppableFor == 'Heroes') {
        action.idsToResolve.push(
            ...game
                .getAllAttackableCards(attacker, game.getAllActiveCards(attacker.oppositionalControllerBoard))
                .filter(attackable => attackable.cardType == 'Hero')
                .map(attackable => attackable.cardId)
        );
    } else if (unstoppableFor == 'Everything') {
        sendAllTargetsAreValid(attacker);
        return;
    } else if (unstoppableFor == 'SkipsTech0Patrollers') {
        patrollersAbleToBlock = patrollersAbleToBlock.filter(defender => defender.cardType != 'Unit' || defender.techLevel != 0);
    } else if (unstoppableFor == 'Units') {
        patrollersAbleToBlock = patrollersAbleToBlock.filter(defender => defender.cardType != 'Unit');
    }

    // check again for patrollers, as now the unattackable alteration may have removed them
    if (patrollersAbleToBlock.length == 0) {
        sendAllTargetsAreValid(attacker);
        return;
    }

    // no sneaking by the patrollers. let's look for a squad leader first
    if (patrollersAbleToBlock.find(patroller => patroller === attacker.oppositionalControllerBoard.patrolZone.squadLeader)) {
        action.idsToResolve.push(attacker.oppositionalControllerBoard.patrolZone.squadLeader.cardId);
        game.addEvent(
            new EventDescriptor('PossibleAttackTargets', 'The squad leader must be attacked first', {
                buldings: false,
                validCardTargetIds: [attacker.oppositionalControllerBoard.patrolZone.squadLeader.cardId]
            })
        );
    }
    // if no squad leader can block, all patrollers are fair game
    else {
        let patrollerIds = patrollersAbleToBlock.map(card => card.cardId);
        action.idsToResolve.push(...patrollerIds);
        game.addEvent(
            new EventDescriptor('PossibleAttackTargets', 'A patroller must be attacked first', {
                buildings: true,
                validCardTargetIds: patrollerIds
            })
        );
    }
}

export function prepareAttackTargetsChoice(choiceValue: string, card: Card, action: string, context: StringMap): boolean {
    if (
        !card.game.phaseStack
            .topOfStack()
            .getAction('DefenderChoice')
            .ifToResolve(choiceValue)
    )
        throw new Error('Invalid choice');
    context.building ? attackChosenTarget(card, context.building) : attackChosenTarget(card, undefined, context.validCardTargetId);

    return true;
}

function sendAllTargetsAreValid(attacker: Character) {
    let game = attacker.game;

    let defenderCards = game.getAllActiveCards(attacker.oppositionalControllerBoard);
    let defenderAttackableCards = game.getAllAttackableCards(attacker, defenderCards);
    let defenderIds = defenderAttackableCards.map(localCard => localCard.cardId);

    let action = new Action('DefenderChoice', false, 1, true);
    game.phaseStack.addToStack(new Phase([action]));
    action.idsToResolve.push(...defenderIds);

    sendBuildingTargetIfValid(attacker, attacker.oppositionalControllerBoard.base, action);
    sendBuildingTargetIfValid(attacker, attacker.oppositionalControllerBoard.tech1, action);
    sendBuildingTargetIfValid(attacker, attacker.oppositionalControllerBoard.tech2, action);
    sendBuildingTargetIfValid(attacker, attacker.oppositionalControllerBoard.tech3, action);
    sendBuildingTargetIfValid(attacker, attacker.oppositionalControllerBoard.addOn, action);

    game.addEvent(
        new EventDescriptor('PossibleAttackTargets', 'No blockers are available. All attack destinations are valid', {
            buildings: true,
            validCardTargetIds: [defenderIds]
        })
    );
}

function sendBuildingTargetIfValid(attacker: Character, boardBuilding: BoardBuilding, action: Action) {
    if (checkBuildingIsAttackable(attacker, boardBuilding)) action.idsToResolve.push(boardBuilding.name);
}

function checkBuildingIsAttackable(attacker: Character, boardBuilding: BoardBuilding): boolean {
    let hookResults = CardApi.hookOrAlteration(attacker.game, 'alterCanAttackBuildings', [attacker, boardBuilding], 'AllActive');
    let preventedFromAttacking = false;

    if (hookResults)
        preventedFromAttacking = hookResults.reduce((previousValue: any, currentValue: any) => !previousValue || !currentValue);

    return !preventedFromAttacking && boardBuilding.isActive();
}

/** Only takes into account flying & not flying. Stealth, invisible, etc is handled elsewhere */
function checkPatrollerCanBlockAttacker(attacker: Card, attackerAttrs: Attributes, patroller: Card): boolean {
    if (!patroller) return false;

    if ((patroller.game.getAllAttackableCards(attacker, [patroller]).length <= 0, true)) return false;

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
        let boardBuilding: BoardBuilding;
        switch (building) {
            case 'Base':
                boardBuilding = attacker.opponentBoard.base;
                break;
            case 'Tech 1':
                boardBuilding = attacker.opponentBoard.tech1;
                break;
            case 'Tech 2':
                boardBuilding = attacker.opponentBoard.tech2;
                break;
            case 'Tech 3':
                boardBuilding = attacker.opponentBoard.tech3;
                break;
            case 'AddOn':
                boardBuilding = attacker.opponentBoard.addOn;
                break;
            default:
                throw new Error('Invalid building target');
        }
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
    /* 1) have to check if building can actually be damaged, as it could be flying or it could be unattackable due to a card effect
     *    1a- call a hook that checks whether or not buildings are attackable? also put this in card targeting rules
     *        alterCanAttackBuildings(cardAttacking: Card, buildingDefender: BoardBuilding): boolean;
     */
    if (!checkBuildingIsAttackable(attacker, building)) {
        throw new Error();
    }

    /* 2) deal dmg to building. use alterCombatDamage */

    /* 3) if flying, take dmg from anti-air */
    /* 4) if tower, take dmg from that */
}
function attackCard(attacker: Card, defender: Card) {
    // enter phase that is empty, to resolve the attack. give it one resolveId (attacker) so it will execute
    // a defender was chosen; fire any defense handlers
    // I think Debilitator Alpha is the only card in the game that is impacted here.  There's no "Safe Defending" card
    // Thus, we implement this as a hook that takes effect immediately. no choosing done by the user
    // check if attacker still alive; if not, we can simply exit this phase indicating that attacker is dead and therefore attack has stopped
    // attacker and defender now deal damage simultaneously to each other
    // tower also does damage
    // account for swift strike. account for anti-air also hitting fliers
    // if there's overpower and there's excess damage to be done, we'll add the overpower phase now, because we want it to be in
    // the stack BEFORE things die (so it will be executed AFTER they die)
    // do sparkshot first; enter phase, pick targets, etc. create a subroutine for this.
    // do overpower next; choose another attack target, and then do direct damage to that target. create a subroutine for this. might trigger dies()
    // call on damage handlers. arguments would be thing doing the damage, thing being damaged.
    // e.g. Guardian of the Gates will disable an attacker, if it survives
    // if the defender and attacker die, go into dies() for each. we do this LAST, so the user will be asked to resolve it FIRST
}

// check BloomingElm.ts for description of temporary stats and how they should work before implementing this

// first process onAttack triggers; these can be re-ordered
// re-ordering stops here

// game state check & trigger loop

// next process damage, process any onDamage triggers (do these exist?)
// no re-ordering possible (i think...)

// check game state & trigger loop

// process sparkshot, overpower if something died; process onDamage triggers on those targets if this is a thing

// check game state & trigger loop

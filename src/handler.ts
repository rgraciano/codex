
import { Card } from './cards/card';
import { EventDescriptor } from './game';

interface AttackHandler {
    onAttack(attacker: Card, defender: Card): EventDescriptor;
}

interface UpkeepHandler {
    upkeepText: string;
    onUpkeep(): EventDescriptor;
}

//function processTriggers(targets: )
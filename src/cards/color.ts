import { Card, Hero } from './card';

import { Spark } from './neutral/starter/Spark';
import { Bloom } from './neutral/starter/Bloom';
import { BrickThief } from './neutral/starter/BrickThief';
import { FruitNinja } from './neutral/starter/FruitNinja';
import { GranfalloonFlagbearer } from './neutral/starter/GranfalloonFlagbearer';
import { HelpfulTurtle } from './neutral/starter/HelpfulTurtle';
import { OlderBrother } from './neutral/starter/OlderBrother';
import { Tenderfoot } from './neutral/starter/Tenderfoot';
import { Wither } from './neutral/starter/Wither';
import { TimelyMessenger } from './neutral/starter/TimelyMessenger';
import { RiverMontoya } from './neutral/finesse/RiverMontoya';

export type ColorName = 'Neutral' | 'Red' | 'Green' | 'Purple' | 'White' | 'Black' | 'Blue';
export type Spec =
    | 'Starter'
    | 'Finesse'
    | 'Bashing'
    | 'Anarchy'
    | 'Blood'
    | 'Fire'
    | 'Growth'
    | 'Balance'
    | 'Feral'
    | 'Past'
    | 'Present'
    | 'Future'
    | 'Discipline'
    | 'Strength'
    | 'Ninjutsu'
    | 'Disease'
    | 'Necromancy'
    | 'Demonology'
    | 'Law'
    | 'Truth'
    | 'Peace';

export const Neutral: Spec[] = ['Finesse', 'Bashing'];
export const Red: Spec[] = ['Anarchy', 'Blood', 'Fire'];
export const Green: Spec[] = ['Growth', 'Balance', 'Feral'];
export const Purple: Spec[] = ['Past', 'Present', 'Future'];
export const White: Spec[] = ['Discipline', 'Strength', 'Ninjutsu'];
export const Black: Spec[] = ['Disease', 'Necromancy', 'Demonology'];
export const Blue: Spec[] = ['Law', 'Truth', 'Peace'];

export const AllSpecs = Neutral.concat(Red, Green, Purple, White, Black, Blue);

export function isValidSpec(potentialSpec: string): boolean {
    return AllSpecs.includes(<Spec>potentialSpec);
}

export function getHeroesForSpecs(specs: Spec[], playerNumber: number): Hero[] {
    return specs.map(curSpec => {
        if (curSpec == 'Finesse') return new RiverMontoya(playerNumber);
        else throw new Error('Hero not yet supported');
    });
}

export function getStarterCardsForSpec(spec: Spec, playerNumber: number): Card[] {
    if (spec == 'Finesse' || spec == 'Bashing')
        return [
            new Bloom(playerNumber),
            new BrickThief(playerNumber),
            new FruitNinja(playerNumber),
            new GranfalloonFlagbearer(playerNumber),
            new HelpfulTurtle(playerNumber),
            new OlderBrother(playerNumber),
            new Spark(playerNumber),
            new Tenderfoot(playerNumber),
            new TimelyMessenger(playerNumber),
            new Wither(playerNumber)
        ];
    else throw new Error('Spec not yet supported');
}

export function isMultiColor(specs: Spec[]): boolean {
    let starterSpec = specs[0];
    let color: Spec[] = undefined;
    let multiColor = false;

    for (let c of [Neutral, Red, Green, Blue, Black, Purple, White]) {
        if (c.includes(starterSpec)) {
            color = c;
            break;
        }
    }

    specs.forEach(spec => {
        if (!color.includes(spec)) multiColor = true;
    });

    return multiColor;
}

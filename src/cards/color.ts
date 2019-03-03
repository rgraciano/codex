

export type ColorName = 'Neutral' | 'Red' | 'Green' | 'Purple' | 'White' | 'Black' | 'Blue';

export const Neutral: NeutralSpecs[] = ['Finesse', 'Bashing'];
export type NeutralSpecs = 'Finesse' | 'Bashing';

export const Red: RedSpecs[] = ['Anarchy', 'Blood', 'Fire'];
export type RedSpecs = 'Anarchy' | 'Blood' | 'Fire';

export const Green: GreenSpecs[] = ['Growth', 'Balance', 'Feral'];
export type GreenSpecs = 'Growth' | 'Balance' | 'Feral';

export const Purple: PurpleSpecs[] = ['Past', 'Present', 'Future'];
export type PurpleSpecs =  'Past' | 'Present' | 'Future';

export const White: WhiteSpecs[] = ['Discipline', 'Strength', 'Ninjutsu'];
export type WhiteSpecs =  'Discipline' | 'Strength' | 'Ninjutsu';

export const Black: BlackSpecs[] = ['Disease', 'Necromancy', 'Demonology'];
export type BlackSpecs = 'Disease' | 'Necromancy' | 'Demonology';

export const Blue: BlueSpecs[] = [ 'Law', 'Truth', 'Peace'];
export type BlueSpecs = 'Law' | 'Truth' | 'Peace';

export type Spec = NeutralSpecs | RedSpecs | GreenSpecs | PurpleSpecs | WhiteSpecs | BlackSpecs | BlueSpecs;
/**
 * Culturally appropriate name generation for the Palusteria simulation.
 *
 * Generates first names and family/clan names based on a person's cultural
 * identity and sex. The system reflects the settlement's demographic reality:
 * because Sauromatian births skew ~6:1 female, each culture maintains a much
 * larger pool of female names than male names.
 *
 * Family-name inheritance follows cultural tradition:
 *   - Sauromatian cultures (kiswani_*, hanjoda_*, sauro_*) → maternal line
 *   - Imanian cultures (imanian_homeland, ansberite) → paternal line
 *   - Townborn / settlement_native → paternal line (Imanian-influenced default)
 *
 * Source: PALUSTERIA_GAME_DESIGN.md §4.1, CLAUDE.md Phase 2 step 6.
 * No React / DOM / store imports — pure simulation logic.
 */

import type { CultureId } from '../turn/game-state';
import type { SeededRNG } from '../../utils/rng';

// ─── Name Lists ───────────────────────────────────────────────────────────────

// Imanian — European-medieval flavoured

const IMANIAN_MALE_NAMES: readonly string[] = [
  'Aldric', 'Brennan', 'Cedric', 'Dunstan', 'Edmund', 'Falric',
  'Gareth', 'Harald', 'Ivor', 'Kenric', 'Leofric', 'Mervyn',
  'Oswyn', 'Peregrin', 'Radulf', 'Sigbert', 'Torald', 'Ulfric',
  'Varric', 'Wulfric', 'Aldhelm', 'Bertram', 'Cormac', 'Dragan',
  'Eddric', 'Forwin', 'Gunthar', 'Herwin', 'Ingvar', 'Joran',
];

const IMANIAN_FEMALE_NAMES: readonly string[] = [
  'Adela', 'Brigid', 'Catrin', 'Elspeth', 'Gwyneth', 'Helena',
  'Isolde', 'Lyra', 'Maren', 'Rowena', 'Saoirse', 'Thalia',
  'Ursula', 'Vesta', 'Wynne', 'Alys', 'Briseis', 'Caelia',
  'Dara', 'Elowen', 'Fiona', 'Greta', 'Hilde', 'Ingrid',
  'Jana', 'Kaeda', 'Lira', 'Mira', 'Nessa', 'Ophira',
  'Pella', 'Quena', 'Riona', 'Sera', 'Tilda', 'Ula',
  'Vanna', 'Willa', 'Xena', 'Ysolde', 'Zara', 'Aelith',
  'Brenna', 'Corva', 'Delphi', 'Erin', 'Freya', 'Gwen',
  'Hesta', 'Ilara', 'Jessa', 'Kova', 'Lenna', 'Mara',
  'Nara', 'Orla', 'Persa', 'Quill', 'Riva', 'Sidra',
  'Talara', 'Undis',
];

const IMANIAN_FAMILY_NAMES: readonly string[] = [
  'Ashford', 'Blackthorn', 'Crestwood', 'Dunwall', 'Ironside',
  'Morley', 'Northcott', 'Redgrave', 'Stonehill', 'Whitmore',
  'Farrow', 'Halveth', 'Colwick', 'Ashby', 'Morrow',
  'Thorn', 'Coalwick', 'Vane', 'Crale', 'Dunmore',
];

// Kiswani — Swahili / East African inspired

const KISWANI_MALE_NAMES: readonly string[] = [
  'Abasi', 'Bakari', 'Chuma', 'Dakarai', 'Enzi', 'Faraji',
  'Hamisi', 'Jabari', 'Kito', 'Mosi', 'Njuki', 'Omari',
  'Pazi', 'Rafiki', 'Simba', 'Taji', 'Uzzi', 'Vikondo',
  'Wazo', 'Xolani', 'Yusuf', 'Zaidi',
  // Extended to meet 30-name minimum
  'Amani', 'Baraka', 'Fundi', 'Gamba', 'Husani', 'Imani', 'Jua', 'Lemi',
];

const KISWANI_FEMALE_NAMES: readonly string[] = [
  'Amara', 'Bahati', 'Dalila', 'Eshe', 'Farida', 'Hadiya',
  'Imara', 'Jamila', 'Kalisha', 'Lulu', 'Makena', 'Nafisa',
  'Oma', 'Penda', 'Rabia', 'Safiya', 'Tamu', 'Uzuri',
  'Wanjiku', 'Zara', 'Amira', 'Baraka', 'Chichi', 'Dina',
  'Elia', 'Femi', 'Gita', 'Hadiza', 'Ifunanya', 'Jola',
  'Kamina', 'Layla', 'Malia', 'Nadia', 'Odessa', 'Pili',
  'Quina', 'Raha', 'Salma', 'Tina', 'Umoja', 'Vumi',
  'Wema', 'Xena', 'Yara', 'Zuena',
  // Extended to meet 60-name minimum
  'Adaeze', 'Bintu', 'Chanda', 'Dayo', 'Fanta', 'Habiba',
  'Ify', 'Kemi', 'Leila', 'Mariam', 'Nana', 'Oby', 'Peju', 'Titi',
];

const KISWANI_CLAN_NAMES: readonly string[] = [
  'Mwamba', 'Nyota', 'Tembo', 'Ujamaa', 'Zawadi',
  'Baraka', 'Chakula', 'Dhamini', 'Elimu', 'Furaha',
];

// Hanjoda — Steppe / Central Asian inspired

const HANJODA_MALE_NAMES: readonly string[] = [
  'Ariq', 'Batu', 'Chagatai', 'Jochi', 'Mongke', 'Noyan',
  'Subotai', 'Temujin', 'Yesugei', 'Altan', 'Berke', 'Chigu',
  'Dorji', 'Erdeni', 'Falun', 'Ghazan', 'Hulegu', 'Ilkhan',
  'Jaghu', 'Kadan', 'Lochun', 'Mungke',
  // Extended to meet 30-name minimum
  'Ogedei', 'Paksig', 'Qaidu', 'Sartaq', 'Toqa', 'Ulchi', 'Vejin', 'Zorigt',
];

const HANJODA_FEMALE_NAMES: readonly string[] = [
  'Altani', 'Borte', 'Chinua', 'Delger', 'Erdene', 'Gerel',
  'Khutulun', 'Mandukhai', 'Naran', 'Odval', 'Sarangerel',
  'Tsetseg', 'Yesui', 'Aruna', 'Bayarma', 'Chimeg', 'Dulmaa',
  'Enkhjargal', 'Gantulga', 'Hulan', 'Indra', 'Jargi',
  'Khatun', 'Lhamo', 'Munkhzul', 'Narantsetseg', 'Oyuna',
  'Purevdorj', 'Ragchaa', 'Solongo', 'Tsenddolgor', 'Uranchimeg',
  'Vanchig', 'Wasig', 'Xulung', 'Yanjmaa', 'Zolzaya',
  'Alimaa', 'Buyant', 'Dulamaa',
  // Extended to meet 60-name minimum
  'Abaga', 'Bayan', 'Chuluun', 'Dolgor', 'Enkh', 'Garid',
  'Hurcha', 'Jod', 'Khaid', 'Lasang', 'Meram', 'Nomun',
  'Onon', 'Pagma', 'Qutlugh', 'Rinchen', 'Saikhan', 'Tegsh', 'Tuya', 'Zul',
];

// Tribe names serve as family names for Hanjoda
const HANJODA_TRIBE_NAMES: readonly string[] = [
  'Stormcaller', 'Bloodmoon', 'Talon', 'Emrasi',
  'Ironveil', 'Skyborn', 'Ashmane', 'Duskwalker',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Picks a random element from a readonly array using the seeded RNG.
 * Never returns undefined — caller guarantees the array is non-empty.
 */
function pickRandom<T>(arr: readonly T[], rng: SeededRNG): T {
  const index = Math.floor(rng.next() * arr.length);
  const item = arr[Math.max(0, Math.min(index, arr.length - 1))];
  // The clamp above guarantees a valid index as long as arr is non-empty.
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return item!;
}

/**
 * Determines whether a CultureId follows Sauromatian naming conventions.
 * Sauromatian cultures use the maternal family-name line.
 */
function isSauromatianCulture(culture: CultureId): boolean {
  return (
    culture === 'kiswani_traditional' ||
    culture === 'hanjoda_traditional' ||
    culture === 'sauro_borderfolk' ||
    culture === 'sauro_wildborn'
  );
}

// ─── Name Pool Selection ──────────────────────────────────────────────────────

type NamePool = {
  male: readonly string[];
  female: readonly string[];
  family: readonly string[];
};

function getNamePool(culture: CultureId): NamePool {
  switch (culture) {
    case 'kiswani_traditional':
    case 'sauro_borderfolk':
      return { male: KISWANI_MALE_NAMES, female: KISWANI_FEMALE_NAMES, family: KISWANI_CLAN_NAMES };

    case 'hanjoda_traditional':
    case 'sauro_wildborn':
      return { male: HANJODA_MALE_NAMES, female: HANJODA_FEMALE_NAMES, family: HANJODA_TRIBE_NAMES };

    case 'townborn':
    case 'settlement_native':
      // Hybrid: first name from Kiswani pool, family name from Imanian pool
      return { male: KISWANI_MALE_NAMES, female: KISWANI_FEMALE_NAMES, family: IMANIAN_FAMILY_NAMES };

    case 'imanian_homeland':
    case 'ansberite':
    default:
      return { male: IMANIAN_MALE_NAMES, female: IMANIAN_FEMALE_NAMES, family: IMANIAN_FAMILY_NAMES };
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generates a culturally appropriate first name and family name for a newborn.
 *
 * Family-name line:
 *   - Sauromatian cultures → motherFamilyName (matrilineal)
 *   - Imanian / townborn / settlement_native → fatherFamilyName (patrilineal)
 *
 * If the relevant parent family name is empty (unknown parent), the function
 * falls back to generating a random family name from the culture's pool.
 *
 * @param sex - Biological sex of the person being named.
 * @param culture - The primary cultural identity of the household / child.
 * @param motherFamilyName - The mother's family/clan name.
 * @param fatherFamilyName - The father's family/clan name (empty string if unknown).
 * @param rng - Seeded PRNG for this turn.
 * @returns An object with `firstName` and `familyName`.
 */
export function generateName(
  sex: 'male' | 'female',
  culture: CultureId,
  motherFamilyName: string,
  fatherFamilyName: string,
  rng: SeededRNG,
): { firstName: string; familyName: string } {
  const pool = getNamePool(culture);

  const firstName = sex === 'female'
    ? pickRandom(pool.female, rng)
    : pickRandom(pool.male, rng);

  // Choose family-name line by cultural tradition
  const lineageName = isSauromatianCulture(culture) ? motherFamilyName : fatherFamilyName;
  const familyName = lineageName.length > 0 ? lineageName : pickRandom(pool.family, rng);

  return { firstName, familyName };
}

/**
 * Generates an earned nickname for a person based on events they have lived through.
 *
 * Stub implementation — always returns `undefined`.
 * Future: earned through specific events ("the Fair", "Riverborn", "Iron-Hand",
 * "Storm-Touched", etc.).
 *
 * @param _person - The person to generate a nickname for.
 * @param _events - The settlement's event history to inspect for qualifying events.
 * @returns A nickname string, or `undefined` if none has been earned.
 */
export function generateNickname(
  _person: unknown,
  _events: unknown,
): string | undefined {
  return undefined;
}

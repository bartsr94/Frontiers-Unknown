import type { EthnicGroup, BloodlineEntry } from '../../simulation/population/person';

export const GROUP_ABBR: Record<EthnicGroup, string> = {
  imanian:             'IMA',
  kiswani_riverfolk:   'KIS-R',
  kiswani_bayuk:       'KIS-B',
  kiswani_haisla:      'KIS-H',
  hanjoda_stormcaller: 'HAN-S',
  hanjoda_bloodmoon:   'HAN-B',
  hanjoda_talon:       'HAN-T',
  hanjoda_emrasi:      'HAN-E',
};

export function heritageAbbr(bloodline: BloodlineEntry[]): string {
  const mixed = bloodline.filter(e => e.fraction > 0.20);
  if (mixed.length >= 2) return 'MIX';
  const dominant = [...bloodline].sort((a, b) => b.fraction - a.fraction)[0];
  return dominant ? GROUP_ABBR[dominant.group] : 'IMA';
}

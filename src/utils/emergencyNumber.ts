const COUNTRY_EMERGENCY: Record<string, string> = {
  US: '911', CA: '911',
  GB: '999', UK: '999', IE: '112',
  NG: '112', ZA: '10111', KE: '999', GH: '112', UG: '999', TZ: '112', RW: '112',
  AU: '000', NZ: '111',
  IN: '112', JP: '110', CN: '110', KR: '112', HK: '999', SG: '999',
  MX: '911', BR: '190', AR: '911',
};

const detectCountry = (): string | null => {
  try {
    const region = (Intl.DateTimeFormat().resolvedOptions() as { region?: string }).region;
    if (region) return region.toUpperCase();
  } catch { /* ignore */ }
  try {
    const lang = (navigator.language || (navigator.languages && navigator.languages[0]) || '').toUpperCase();
    const m = lang.match(/-([A-Z]{2})/);
    if (m) return m[1];
  } catch { /* ignore */ }
  return null;
};

export function getEmergencyNumber(): string {
  const country = detectCountry();
  if (country && COUNTRY_EMERGENCY[country]) return COUNTRY_EMERGENCY[country];
  return '112';
}

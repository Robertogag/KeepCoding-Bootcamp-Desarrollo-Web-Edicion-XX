const FALLBACK = [
  'America/Mexico_City',
  'America/Monterrey',
  'America/Tijuana',
  'America/Bogota',
  'America/Lima',
  'America/Santiago',
  'America/Argentina/Buenos_Aires',
  'America/Sao_Paulo',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/Madrid',
  'Europe/Lisbon',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Seoul',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'UTC',
];

// La lista completa sale del propio motor Intl; la de respaldo cubre navegadores sin supportedValuesOf.
export function listTimeZones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (key: 'timeZone') => string[] };
  const zones = intl.supportedValuesOf?.('timeZone');
  return zones && zones.length > 0 ? zones : FALLBACK;
}

export function guessTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Mexico_City';
  } catch {
    return 'America/Mexico_City';
  }
}

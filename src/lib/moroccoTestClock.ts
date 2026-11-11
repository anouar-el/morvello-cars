/*
 * Utilitaire de tests : instant correspondant à une heure murale marocaine.
 * Le Maroc alterne entre UTC+0 et UTC+1 (Ramadan, évolutions de la base de fuseaux) : écrire les
 * instants en UTC avec un décalage supposé rend les tests dépendants de la version de tzdata de la machine.
 */

const FORMAT = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Africa/Casablanca',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** `atMorocco('2026-10-21 08:30')` : l'instant où il est 08:30 à Casablanca ce jour-là. */
export function atMorocco(wallClock: string): Date {
  const wanted = wallClock.replace('T', ' ');
  const asIfUtc = Date.parse(`${wanted.replace(' ', 'T')}:00Z`);
  for (const offsetHours of [0, 1, 2, -1]) {
    const candidate = new Date(asIfUtc - offsetHours * 3_600_000);
    if (FORMAT.format(candidate).replace(',', '') === wanted) return candidate;
  }
  throw new Error(`Heure marocaine introuvable : ${wallClock}`);
}

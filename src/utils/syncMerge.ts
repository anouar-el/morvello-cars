// Fusion « la base fait foi » entre l'état distant (Supabase, filtré par RLS) et l'état local.
//
// Avant : tout enregistrement présent seulement en local était réinjecté puis réécrit en base,
// ce qui ressuscitait les suppressions faites par un autre utilisateur.
// Maintenant : la liste distante remplace la liste locale. Seuls survivent les enregistrements
// créés localement dont l'écriture n'a pas (encore) abouti (« pending »).

export function mergeAuthoritative<T extends { id: string }>(
  remote: T[],
  local: T[],
  isPendingCreate: (id: string) => boolean,
  sameEntity?: (remoteItem: T, localItem: T) => boolean
): T[] {
  const remoteIds = new Set(remote.map((r) => r.id));
  const extras = local.filter(
    (l) =>
      !remoteIds.has(l.id) &&
      isPendingCreate(l.id) &&
      !(sameEntity && remote.some((r) => sameEntity(r, l)))
  );
  return extras.length > 0 ? [...remote, ...extras] : remote;
}

/** Insère ou remplace un enregistrement par id (événement temps réel INSERT/UPDATE). */
export function upsertById<T extends { id: string }>(list: T[], record: T): T[] {
  const idx = list.findIndex((r) => r.id === record.id);
  if (idx === -1) return [record, ...list];
  const next = list.slice();
  next[idx] = record;
  return next;
}

/** Retire un enregistrement par id (événement temps réel DELETE). */
export function removeById<T extends { id: string }>(list: T[], id: string): T[] {
  return list.some((r) => r.id === id) ? list.filter((r) => r.id !== id) : list;
}

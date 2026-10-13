export type FocusKind = 'contract' | 'vehicle' | 'client';

const pending: Partial<Record<FocusKind, string>> = {};

/** Demande à la liste cible de s'ouvrir déjà filtrée sur un élément (lien depuis une réponse de l'assistant). */
export function requestEntityFocus(kind: FocusKind, search: string): void {
  pending[kind] = search;
}

/** Lu une seule fois par la liste à son affichage : renvoie la recherche à appliquer, puis l'oublie. */
export function takeEntityFocus(kind: FocusKind): string | undefined {
  const value = pending[kind];
  delete pending[kind];
  return value;
}

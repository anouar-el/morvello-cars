import type { UserRole } from '../types';

/*
 * Auteur des entrées du journal d'audit. Le fournisseur du journal est monté au-dessus de
 * l'authentification : il ne connaît pas l'utilisateur connecté. L'application renseigne donc ici
 * l'utilisateur courant, et chaque nouvelle entrée est signée par lui au lieu d'un nom générique.
 */

export interface AuditActor {
  name: string;
  role: UserRole;
}

const FALLBACK: AuditActor = { name: 'Morvello System', role: 'admin' };

let current: AuditActor = FALLBACK;

export function setAuditActor(actor: AuditActor | null): void {
  current = actor && actor.name ? actor : FALLBACK;
}

export function getAuditActor(): AuditActor {
  return current;
}

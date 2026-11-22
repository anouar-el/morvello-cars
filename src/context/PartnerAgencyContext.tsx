import React, { createContext, useContext, useMemo } from 'react';

/**
 * Habillage « agence partenaire » : sert à éditer un contrat au nom d'une AUTRE agence avec nos modèles.
 * Hors de ce contexte (contrats Morvello), rien ne change : `useBrand()` renvoie l'identité Morvello.
 */
export interface PartnerAgency {
  name: string;
  /** Logo de l'agence (data URL). Sans logo, le nom de l'agence est imprimé à la place. */
  logo?: string;
  /** Ville : lieu de remise des clés, « Fait à … » et tribunal compétent. */
  city?: string;
  /** Mention légale facultative, ex. « SARL au capital de 100 000 MAD ». */
  legalLine?: string;
}

const PartnerAgencyContext = createContext<PartnerAgency | null>(null);

export const PartnerAgencyProvider: React.FC<{ agency: PartnerAgency; children: React.ReactNode }> = ({ agency, children }) => (
  <PartnerAgencyContext.Provider value={agency}>{children}</PartnerAgencyContext.Provider>
);

export function usePartnerAgency(): PartnerAgency | null {
  return useContext(PartnerAgencyContext);
}

export interface Brand {
  isPartner: boolean;
  /** Raison sociale en majuscules : « MORVELLO CARS » ou l'agence partenaire. */
  name: string;
  /** Forme courte pour les phrases : « Morvello » ou l'agence partenaire. */
  shortName: string;
  /** Ville de l'agence (peut être vide pour un partenaire). */
  city: string;
  /** Lieu de remise / restitution du véhicule. */
  place: string;
  /** Mention légale sous le nom (capital…), vide si aucune. */
  legalLine: string;
  logo?: string;
}

const MORVELLO_BRAND: Brand = {
  isPartner: false,
  name: 'MORVELLO CARS',
  shortName: 'Morvello',
  city: 'Casablanca',
  place: 'Nouaceur / Casablanca',
  legalLine: 'SARL au Capital de 100 000 MAD',
};

export function brandFromPartner(partner: PartnerAgency): Brand {
  const name = partner.name.trim() || 'AGENCE';
  const city = (partner.city || '').trim();
  return {
    isPartner: true,
    name: name.toUpperCase(),
    shortName: name,
    city,
    place: city,
    legalLine: (partner.legalLine || '').trim(),
    logo: partner.logo,
  };
}

/** Identité à imprimer sur le contrat : Morvello, ou l'agence partenaire quand le contexte est présent. */
export function useBrand(): Brand {
  const partner = useContext(PartnerAgencyContext);
  return useMemo(() => (partner ? brandFromPartner(partner) : MORVELLO_BRAND), [partner]);
}

/**
 * Conditions générales au nom de l'agence partenaire : « MORVELLO CARS » devient son nom,
 * et le tribunal compétent devient celui de sa ville quand elle est renseignée.
 */
export function brandTermsForPartner<T extends { title: string; clauses: { content: string; title: string }[] }>(
  terms: T,
  partner: PartnerAgency
): T {
  const brand = brandFromPartner(partner);
  const swap = (text: string) => {
    let out = text.replace(/MORVELLO CARS/gi, brand.name);
    if (brand.city) out = out.replace(/Tribunaux de Casablanca/g, `Tribunaux de ${brand.city}`);
    return out;
  };
  return {
    ...terms,
    title: swap(terms.title),
    clauses: terms.clauses.map((c) => ({ ...c, title: swap(c.title), content: swap(c.content) })),
  };
}

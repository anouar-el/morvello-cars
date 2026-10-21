import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nProvider } from '../../i18n/I18nContext';
import { ClientObservationForm, EMPTY_OBSERVATION, isObservationFilled } from './ClientObservationForm';
import { OBSERVATION_TAGS } from '../../lib/clientObservations';

// Pas de jsdom dans le projet : le rendu serveur n'a besoin que d'un localStorage factice (la langue)
(globalThis as any).localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const render = (value = EMPTY_OBSERVATION) =>
  renderToStaticMarkup(
    <I18nProvider>
      <ClientObservationForm value={value} onChange={() => {}} />
    </I18nProvider>
  );

describe('ClientObservationForm', () => {
  it('affiche 5 étoiles, toutes les étiquettes et le champ de commentaire', () => {
    const html = render();
    expect(html.match(/role="radio"/g)).toHaveLength(5);
    for (const tag of OBSERVATION_TAGS) expect(html).toContain(tag.label);
    expect(html).toContain('<textarea');
  });

  it("rappelle de choisir une note quand l'observation est remplie sans note", () => {
    expect(render({ rating: null, tags: ['late_return'], comment: '' })).toContain('Choisissez une note');
    expect(render()).not.toContain('Choisissez une note');
  });

  it("marque l'étiquette cochée et la note choisie", () => {
    const html = render({ rating: 2, tags: ['damage'], comment: 'Rayure' });
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('Décevant');
  });
});

describe('isObservationFilled', () => {
  it('distingue un formulaire vide', () => {
    expect(isObservationFilled(EMPTY_OBSERVATION)).toBe(false);
    expect(isObservationFilled({ rating: null, tags: [], comment: '  ' })).toBe(false);
    expect(isObservationFilled({ rating: 3, tags: [], comment: '' })).toBe(true);
  });
});

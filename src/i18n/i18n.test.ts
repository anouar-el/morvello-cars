import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { AR } from './ar';
import { translate } from './I18nContext';
import { REMINDER_LABELS } from '../lib/reminders';

describe('translate', () => {
  it('renvoie le français tel quel en mode français, paramètres remplacés', () => {
    expect(translate('fr', 'Retour prévu le {date}', { date: '13/10/2026' })).toBe('Retour prévu le 13/10/2026');
  });

  it('traduit en arabe et remplace les paramètres', () => {
    expect(translate('ar', 'Contrats')).toBe('العقود');
    expect(translate('ar', 'Retour prévu le {date}', { date: '13/10/2026' })).toBe('الإرجاع المتوقع يوم 13/10/2026');
  });

  it('retombe sur le français quand une traduction manque (jamais de texte vide)', () => {
    expect(translate('ar', 'Texte inconnu {n}', { n: 2 })).toBe('Texte inconnu 2');
  });

  it('laisse un paramètre absent tel quel plutôt que « undefined »', () => {
    expect(translate('ar', 'Bonjour, {name}')).toBe('مرحبًا، {name}');
  });

  it('traduit les alertes composées à partir de données', () => {
    expect(translate('ar', 'Retard 3j')).toBe('تأخر 3 أيام');
    expect(translate('ar', 'Retard de restitution : Dacia Duster (123-A-45)')).toBe('تأخر في الإرجاع: Dacia Duster (123-A-45)');
    expect(translate('ar', 'Dacia Duster (123-A-45) : Assurance')).toContain('Assurance');
    expect(translate('ar', 'Expirée depuis 5 j')).toBe('منتهية منذ 5 أيام');
    expect(translate('ar', 'Dacia Duster (123-A-45) : Visite Technique')).toBe('Dacia Duster (123-A-45) : Visite Technique');
  });
});

describe('dictionnaire arabe', () => {
  it('ne contient aucune traduction vide', () => {
    for (const [key, value] of Object.entries(AR)) {
      expect(value.trim(), `traduction vide pour « ${key} »`).not.toBe('');
    }
  });

  it('garde les mêmes paramètres {nom} que le texte français', () => {
    const names = (s: string) => (s.match(/\{\w+\}/g) || []).sort().join(',');
    for (const [key, value] of Object.entries(AR)) {
      expect(names(value), `paramètres différents pour « ${key} »`).toBe(names(key));
    }
  });

  it('couvre les libellés des relances', () => {
    for (const label of Object.values(REMINDER_LABELS)) {
      expect(AR[label], `« ${label} » non traduit`).toBeTruthy();
    }
  });
});

function listTsx(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return listTsx(p);
    return /\.tsx$/.test(name) && !/\.test\./.test(name) ? [p] : [];
  });
}

describe('couverture des appels t(...)', () => {
  it('chaque texte passé littéralement à t() existe dans le dictionnaire arabe', () => {
    const missing: string[] = [];
    for (const file of listTsx('src')) {
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(/\bt\('((?:[^'\\]|\\.)*)'/g)) {
        const key = m[1].replace(/\\'/g, "'");
        if (!(key in AR)) missing.push(`${file}: ${key}`);
      }
      for (const m of src.matchAll(/\bt\("((?:[^"\\]|\\.)*)"/g)) {
        if (!(m[1] in AR)) missing.push(`${file}: ${m[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

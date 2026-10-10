import { describe, it, expect } from 'vitest';
import { mergeAuthoritative, upsertById, removeById } from './syncMerge';

type Item = { id: string; name?: string };

describe('mergeAuthoritative (la base fait foi)', () => {
  it('supprime les éléments locaux absents de la base (suppression par un autre utilisateur)', () => {
    const remote: Item[] = [{ id: 'a' }];
    const local: Item[] = [{ id: 'a' }, { id: 'b' }];
    expect(mergeAuthoritative(remote, local, () => false).map((i) => i.id)).toEqual(['a']);
  });

  it('conserve une création locale dont l\'écriture est en attente', () => {
    const remote: Item[] = [{ id: 'a' }];
    const local: Item[] = [{ id: 'a' }, { id: 'new' }];
    const merged = mergeAuthoritative(remote, local, (id) => id === 'new');
    expect(merged.map((i) => i.id)).toEqual(['a', 'new']);
  });

  it('ne duplique pas une création en attente déjà présente en base sous un autre id', () => {
    const remote: Item[] = [{ id: 'srv-1', name: 'X' }];
    const local: Item[] = [{ id: 'loc-1', name: 'X' }];
    const merged = mergeAuthoritative(remote, local, () => true, (r, l) => r.name === l.name);
    expect(merged).toHaveLength(1);
  });

  it('une liste distante vide fait foi', () => {
    expect(mergeAuthoritative<Item>([], [{ id: 'a' }], () => false)).toEqual([]);
  });

  it('prend la version distante pour un id commun', () => {
    const remote: Item[] = [{ id: 'a', name: 'distant' }];
    const local: Item[] = [{ id: 'a', name: 'local' }];
    expect(mergeAuthoritative(remote, local, () => false)[0].name).toBe('distant');
  });
});

describe('upsertById / removeById', () => {
  it('insère puis remplace sans doublon', () => {
    let list: Item[] = [];
    list = upsertById(list, { id: 'a', name: '1' });
    list = upsertById(list, { id: 'a', name: '2' });
    expect(list).toEqual([{ id: 'a', name: '2' }]);
  });

  it('retire par id et garde la référence si absent', () => {
    const list: Item[] = [{ id: 'a' }];
    expect(removeById(list, 'a')).toEqual([]);
    expect(removeById(list, 'zzz')).toBe(list);
  });
});

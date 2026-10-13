/*
 * Textes composés à partir de données (alertes, détails de conformité) : ils n'ont pas une clé fixe, on les
 * reconnaît par leur forme. Chaque motif renvoie la phrase arabe, ou null si rien ne correspond.
 * `tr` traduit un morceau déjà isolé (ex. « Assurance »).
 */

type Translate = (text: string) => string;
type Pattern = [RegExp, (m: RegExpMatchArray, tr: Translate) => string];

const PLURAL = (n: string) => (Number(n) > 1 ? 'أيام' : 'يوم');

export const AR_PATTERNS: Pattern[] = [
  // Alertes de retour
  [/^Retard de restitution : (.+)$/, (m) => `تأخر في الإرجاع: ${m[1]}`],
  [
    /^Contrat #(\S+) \((.*)\) devait être restitué le (\S+) \(en retard de (\d+) j\)\.$/,
    (m) => `العقد #${m[1]} (${m[2]}) كان يجب إرجاعه يوم ${m[3]} (متأخر بـ ${m[4]} ${PLURAL(m[4])}).`,
  ],
  [/^Retard (\d+)j$/, (m) => `تأخر ${m[1]} ${PLURAL(m[1])}`],
  [/^Restitution attendue aujourd'hui : (.+)$/, (m) => `إرجاع منتظر اليوم: ${m[1]}`],
  [/^Contrat #(\S+) \((.*)\) à réceptionner avant (\S+)\.$/, (m) => `العقد #${m[1]} (${m[2]}) للاستلام قبل ${m[3]}.`],
  [/^Restitution sous (\d+)j : (.+)$/, (m) => `إرجاع خلال ${m[1]} ${PLURAL(m[1])}: ${m[2]}`],
  [/^Contrat #(\S+) \((.*)\) - Fin prévue le (\S+)\.$/, (m) => `العقد #${m[1]} (${m[2]}) - النهاية المتوقعة يوم ${m[3]}.`],
  [/^Dans (\d+)j$/, (m) => `بعد ${m[1]} ${PLURAL(m[1])}`],

  // Conformité des véhicules : « <véhicule> : <rubrique> »
  [/^(.+\(.*\)) : (Assurance|Visite Technique|Vignette|Vidange)$/, (m, tr) => `${m[1]} : ${tr(m[2])}`],
  [/^Non renseignée$/, () => 'غير مُدخلة'],
  [/^Date invalide$/, () => 'تاريخ غير صالح'],
  [/^Expire aujourd'hui !$/, () => 'تنتهي اليوم!'],
  [/^Expirée depuis (\d+) j$/, (m) => `منتهية منذ ${m[1]} ${PLURAL(m[1])}`],
  [/^Expire dans (\d+) jours?$/, (m) => `تنتهي خلال ${m[1]} ${PLURAL(m[1])}`],
  [/^Valide \((\d+) j restants\)$/, (m) => `صالحة (${m[1]} يوم متبقية)`],
  [/^En règle \((\d+) j restants\)$/, (m) => `مطابقة (${m[1]} يوم متبقية)`],
  [/^Vignette (\d+) à vérifier$/, (m) => `ضريبة ${m[1]} للتحقق`],
  [/^Non payée pour (\d+) \(payée (\d+)\)$/, (m) => `غير مؤدّاة لسنة ${m[1]} (آخر أداء ${m[2]})`],
  [/^Vignette (\d+) payée$/, (m) => `ضريبة ${m[1]} مؤدّاة`],
  [/^Non planifiée$/, () => 'غير مبرمجة'],
  [/^Dépassée de (.+) KM$/, (m) => `تم تجاوزها بـ ${m[1]} كلم`],
  [/^À faire dans (.+) KM$/, (m) => `للإنجاز خلال ${m[1]} كلم`],
  [/^(.+) KM restants$/, (m) => `${m[1]} كلم متبقية`],

  // Cautions
  [/^Caution non libérée sur contrat clôturé : (.+)$/, (m) => `ضمان غير محرَّر على عقد مغلق: ${m[1]}`],
  [
    /^Caution de (.+) MAD \(#(\S+)\) non libérée alors que le contrat est terminé\.$/,
    (m) => `ضمان بقيمة ${m[1]} درهم (#${m[2]}) غير محرَّر رغم انتهاء العقد.`,
  ],
  [/^Caution à traiter lors de la restitution : (.+)$/, (m) => `ضمان للمعالجة عند الإرجاع: ${m[1]}`],
  [
    /^Caution de (.+) MAD \(#(\S+)\) à restituer ou déduire lors du retour prévu aujourd'hui\.$/,
    (m) => `ضمان بقيمة ${m[1]} درهم (#${m[2]}) يُسترجع أو يُخصم عند الإرجاع المتوقع اليوم.`,
  ],
];

/** Traduction d'un texte composé ; null si aucun motif ne correspond. */
export function translatePattern(text: string, tr: Translate): string | null {
  for (const [re, fn] of AR_PATTERNS) {
    const m = text.match(re);
    if (m) return fn(m, tr);
  }
  return null;
}

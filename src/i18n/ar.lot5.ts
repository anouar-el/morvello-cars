/*
 * Lot 5 : réservations sans contrat et observations sur le comportement des clients.
 * Arabe standard simple ; le terme français est gardé entre parenthèses quand le mot arabe peut prêter à confusion.
 */
export const AR_LOT5: Record<string, string> = {
  // Stockage des photos et scans
  'Document archivé : aucun fichier numérisé.': 'مستند مؤرشف: لا يوجد ملف ممسوح.',
  Archivé: 'مؤرشف',
  'Chargement du document…': 'جارٍ تحميل المستند…',
  'Document introuvable.': 'المستند غير موجود.',
  'Stockage des photos et scans': 'تخزين الصور والمستندات الممسوحة',
  "Les photos, scans d'identité et signatures sont rangés dans un espace sécurisé, hors des fiches, pour que l'application reste légère.":
    'تُحفظ الصور ومسوحات الهوية والتوقيعات في فضاء آمن خارج الملفات حتى يبقى التطبيق خفيفًا.',
  'Mémoire locale de cet appareil': 'الذاكرة المحلية لهذا الجهاز',
  'Mémoire presque pleine : déplacez les photos et scans ci-dessous.': 'الذاكرة شبه ممتلئة: انقل الصور والمستندات الممسوحة أدناه.',
  'Aucune photo ni aucun scan intégré dans les fiches : tout est déjà dans le stockage sécurisé.':
    'لا توجد صور ولا مسوحات مدمجة في الملفات: كل شيء موجود في التخزين الآمن.',
  '{count} fichier(s) encore intégré(s) dans les fiches ({size}) : clients {clients}, véhicules {vehicles}, contrats {contracts}.':
    '{count} ملف (ملفات) لا تزال مدمجة في الملفات ({size}): الزبناء {clients}، السيارات {vehicles}، العقود {contracts}.',
  'Déplacement… {done}/{total}': 'جارٍ النقل… {done}/{total}',
  'Déplacer vers le stockage sécurisé': 'نقل إلى التخزين الآمن',
  'Arrêter': 'إيقاف',
  "Supabase n'est pas configuré sur cette version : déplacement indisponible.": 'Supabase غير مُهيّأ في هذه النسخة: النقل غير متاح.',
  "Opération sans risque et relançable : un fichier n'est retiré d'une fiche qu'une fois bien enregistré dans le stockage.":
    'عملية آمنة ويمكن إعادتها: لا يُزال ملف من الملف الشخصي إلا بعد حفظه جيدًا في التخزين.',
  "Le stockage n'est pas prêt. Exécutez d'abord le script supabase_migration_storage_buckets.sql dans Supabase (SQL Editor), puis relancez.":
    'التخزين غير جاهز. شغّل أولًا السكريبت supabase_migration_storage_buckets.sql في Supabase (SQL Editor) ثم أعد المحاولة.',
  '{moved} fichier(s) déplacé(s) dans {records} fiche(s), {size} libérés.': 'تم نقل {moved} ملف (ملفات) في {records} ملف (ملفات)، وتحرير {size}.',
  'Arrêté avant la fin : relancez pour continuer.': 'توقّف قبل النهاية: أعد التشغيل للمتابعة.',
  '{n} élément(s) non déplacé(s) : relancez pour réessayer.': '{n} عنصر (عناصر) لم يُنقل: أعد التشغيل للمحاولة مجددًا.',

  // Contrat PDF sur iPhone
  Réessayer: 'إعادة المحاولة',
  'PDF prêt': 'ملف PDF جاهز',
  'Partager / Enregistrer': 'مشاركة / حفظ',
  'Ouvrir le PDF': 'فتح ملف PDF',
  'Astuce : « Enregistrer dans Fichiers » garde le contrat sur votre iPhone.': 'نصيحة: «حفظ في الملفات» يُبقي العقد على هاتفك.',
  "La mémoire de l'appareil est insuffisante pour générer le PDF. Fermez les autres onglets et applications, puis réessayez.":
    'ذاكرة الجهاز غير كافية لإنشاء ملف PDF. أغلق التبويبات والتطبيقات الأخرى ثم أعد المحاولة.',
  "Le logo, le cachet ou une signature n'ont pas fini de se charger. Vérifiez votre connexion, patientez quelques secondes, puis réessayez.":
    'لم يكتمل تحميل الشعار أو الختم أو التوقيع. تحقّق من اتصالك وانتظر بضع ثوانٍ ثم أعد المحاولة.',
  "Un fichier du contrat (signature ou photo) est introuvable dans le stockage. Rouvrez le contrat ou contactez l'administrateur.":
    'ملف من العقد (توقيع أو صورة) غير موجود في التخزين. أعد فتح العقد أو اتصل بالمسؤول.',
  "Le contrat n'a pas fini de s'afficher. Patientez un instant, puis réessayez.": 'لم يكتمل عرض العقد بعد. انتظر لحظة ثم أعد المحاولة.',
  'La génération du PDF a échoué. Réessayez, ou utilisez « Imprimer (A4) ».': 'فشل إنشاء ملف PDF. أعد المحاولة أو استعمل «طباعة (A4)».',
  "Le partage n'est pas disponible ici : utilisez « Ouvrir le PDF » ci-dessous.": 'المشاركة غير متاحة هنا: استعمل «فتح ملف PDF» أدناه.',
  'Le partage a échoué : utilisez « Ouvrir le PDF » ci-dessous.': 'فشلت المشاركة: استعمل «فتح ملف PDF» أدناه.',

  // Notifications push
  'Recevez le point du jour sur votre téléphone': 'توصّل بملخّص اليوم على هاتفك',
  'Un résumé chaque matin (retards, retours, réservations) et une alerte immédiate en cas de retard.':
    'ملخّص كل صباح (التأخرات، الإرجاعات، الحجوزات) وتنبيه فوري عند حدوث تأخر.',
  'Activer les notifications': 'تفعيل الإشعارات',
  'Notifications activées sur cet appareil': 'الإشعارات مفعّلة على هذا الجهاز',
  'Envoyer un essai': 'إرسال إشعار تجريبي',
  Désactiver: 'إيقاف',
  "Impossible d'activer les notifications pour le moment. Réessayez.": 'تعذّر تفعيل الإشعارات حاليًا. أعد المحاولة.',
  'Impossible de désactiver les notifications pour le moment.': 'تعذّر إيقاف الإشعارات حاليًا.',
  'Notification envoyée : regardez votre téléphone.': 'تم إرسال الإشعار: انظر إلى هاتفك.',
  "L'envoi d'essai a échoué.": 'فشل الإرسال التجريبي.',
  "Sur iPhone, installez d'abord l'app sur l'écran d'accueil (Partager → Sur l'écran d'accueil) pour activer les notifications.":
    'على iPhone، ثبّت التطبيق أولًا على الشاشة الرئيسية (مشاركة ← إضافة إلى الشاشة الرئيسية) لتفعيل الإشعارات.',
  'Les notifications sont bloquées. Autorisez-les dans les réglages de votre navigateur pour cette application, puis revenez ici.':
    'الإشعارات محظورة. اسمح بها في إعدادات المتصفح لهذا التطبيق ثم عُد إلى هنا.',

  // Observations : formulaire
  'Note globale du client': 'التقييم العام للزبون',
  'Choisissez une note pour enregistrer cette observation.': 'اختر تقييمًا لحفظ هذه الملاحظة.',
  'Comportement constaté': 'السلوك الملاحَظ',
  Observation: 'ملاحظة',
  'Faits précis : dates, retards, dommages… (évitez les jugements personnels)': 'وقائع دقيقة: تواريخ، تأخيرات، أضرار… (تجنّب الأحكام الشخصية)',
  'Observation sur le client': 'ملاحظة حول الزبون',
  "Fiche client introuvable : impossible d'enregistrer.": 'ملف الزبون غير موجود: تعذّر الحفظ.',
  '{n} observation(s) déjà enregistrée(s)': '{n} ملاحظة (ملاحظات) محفوظة سابقًا',
  "Enregistrer l'observation": 'حفظ الملاحظة',
  'Supprimer cette observation ?': 'حذف هذه الملاحظة؟',
  'Comportement du client': 'سلوك الزبون',
  'Réservé à la direction. Ne figure jamais sur le contrat.': 'خاص بالإدارة. لا يظهر أبدًا في العقد.',
  'Ajouter une observation': 'إضافة ملاحظة',
  "Aucune observation pour l'instant.": 'لا توجد ملاحظات حاليًا.',
  'Comportement du client pendant cette location': 'سلوك الزبون خلال هذا الكراء',
  'Facultatif. Réservé à la direction : vous le retrouverez avant sa prochaine location.': 'اختياري. خاص بالإدارة: ستجدها قبل كرائه القادم.',

  // Niveaux et notes
  'Bon client': 'زبون جيد',
  'À éviter': 'يُفضَّل تجنّبه',
  Excellent: 'ممتاز',
  'Excellent client': 'زبون ممتاز',
  Décevant: 'مخيّب',
  Correct: 'مقبول',
  'Ce client demande votre attention': 'هذا الزبون يستدعي انتباهك',

  // Étiquettes de comportement
  Ponctuel: 'يحترم المواعيد',
  Courtois: 'مهذّب',
  'Véhicule propre': 'سيارة نظيفة',
  'Conduite soigneuse': 'سياقة حذرة',
  'Retard au retour': 'تأخر عند الإرجاع',
  'Véhicule sale': 'سيارة متّسخة',
  'Carburant non respecté': 'عدم احترام مستوى الوقود',
  'Km dépassés': 'تجاوز الكيلومترات',
  'Paiement difficile': 'صعوبة في الأداء',
  Litige: 'نزاع',
  'Absent à la réservation': 'لم يحضر للحجز',

  // Réservations
  'Réserver un véhicule pour ce client': 'حجز سيارة لهذا الزبون',
  Réserver: 'حجز',
  Réservation: 'حجز',
  'Réservations à venir': 'الحجوزات القادمة',
  'Prises sans contrat : à transformer le jour du départ.': 'حجوزات بدون عقد: تُحوَّل إلى عقد يوم الانطلاق.',
  'Nouvelle réservation': 'حجز جديد',
  'Modifier la réservation': 'تعديل الحجز',
  'Annuler cette réservation ?': 'إلغاء هذا الحجز؟',
  'Annuler la réservation': 'إلغاء الحجز',
  'Sans contrat : à transformer en contrat le jour du départ.': 'بدون عقد: يُحوَّل إلى عقد يوم الانطلاق.',
  'Choisissez un client.': 'اختر زبونًا.',
  Changer: 'تغيير',
  'Nom, téléphone ou CIN…': 'الاسم أو الهاتف أو رقم البطاقة الوطنية…',
  "Aucun client trouvé. Créez d'abord sa fiche dans « Clients ».": 'لم يتم العثور على زبون. أنشئ ملفه أولًا في «الزبناء».',
  'Consultez son historique avant de confirmer.': 'اطّلع على سجلّه قبل التأكيد.',
  'Véhicule (facultatif)': 'السيارة (اختياري)',
  'À définir plus tard': 'تُحدَّد لاحقًا',
  'Véhicule à définir': 'سيارة غير محدّدة بعد',
  'Ce véhicule est déjà pris sur ces dates': 'هذه السيارة محجوزة في هذه التواريخ',
  'Acompte reçu (MAD)': 'دفعة مسبقة (Acompte) مستلمة (درهم)',
  'Acompte {amount} MAD': 'دفعة مسبقة (Acompte) {amount} درهم',
  'Acompte de {amount} MAD déjà reçu.': 'تم استلام دفعة مسبقة (Acompte) بقيمة {amount} درهم.',
  Note: 'ملاحظة',
  'Demande particulière, lieu de remise…': 'طلب خاص، مكان التسليم…',
  'Renseignez les dates de début et de fin.': 'أدخل تاريخَي البداية والنهاية.',
  'La date de fin doit être après la date de début.': 'يجب أن يكون تاريخ النهاية بعد تاريخ البداية.',
  'En retard de {n} j': 'متأخر بـ {n} يوم',
  'Dans {n} j': 'بعد {n} يوم',
  "Aujourd'hui à {time}": 'اليوم على الساعة {time}',
  'Créer le contrat': 'إنشاء العقد',
  "Aucune réservation en attente. Notez ici les clients qui réservent sans contrat pour ne plus les oublier.":
    'لا توجد حجوزات في الانتظار. سجّل هنا الزبناء الذين يحجزون بدون عقد حتى لا تنساهم.',
  "Contrat créé à partir d'une réservation": 'عقد منشأ انطلاقًا من حجز',
  'Client, véhicule et dates sont préremplis : vérifiez-les avant de continuer.': 'الزبون والسيارة والتواريخ معبّأة مسبقًا: تحقّق منها قبل المتابعة.',

  // Navigation et en-têtes de page
  'Nouveau client': 'زبون جديد',
  'Nouveau véhicule': 'سيارة جديدة',
  'Proposer un véhicule': 'اقتراح سيارة',
  Exploitation: 'التشغيل',
  'Flotte & clients': 'الأسطول والزبناء',
  Administration: 'الإدارة',
  'Navigation principale': 'التنقل الرئيسي',
  'Rechercher un contrat, un client, un véhicule…': 'ابحث عن عقد أو زبون أو سيارة…',
  'Recherche globale': 'بحث شامل',
  'N° contrat, nom, téléphone, CIN, immatriculation…': 'رقم العقد، الاسم، الهاتف، رقم البطاقة، رقم اللوحة…',
  'Tapez pour chercher dans vos contrats, clients et véhicules.': 'اكتب للبحث في العقود والزبناء والسيارات.',
  'Aucun résultat.': 'لا توجد نتائج.',

  // Planning des véhicules
  'Planning des véhicules': 'جدول السيارات',
  Planning: 'الجدول الزمني',
  'Locations et réservations jour par jour': 'الكراءات والحجوزات يومًا بيوم',
  'Contrats et réservations jour par jour : repérez les véhicules libres avant de réserver.': 'العقود والحجوزات يومًا بيوم: اعرف السيارات الشاغرة قبل الحجز.',
  'Période précédente': 'الفترة السابقة',
  'Période suivante': 'الفترة التالية',
  'Durée affichée': 'المدة المعروضة',
  '{n} j': '{n} يوم',
  'Location en cours': 'كراء جارٍ',
  'Terminée': 'منتهٍ',
  'Aucun véhicule à afficher.': 'لا توجد سيارات للعرض.',
  "{n} libre(s) aujourd'hui": '{n} شاغرة اليوم',
};

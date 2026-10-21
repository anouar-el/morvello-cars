/*
 * Lot 5 : réservations sans contrat et observations sur le comportement des clients.
 * Arabe standard simple ; le terme français est gardé entre parenthèses quand le mot arabe peut prêter à confusion.
 */
export const AR_LOT5: Record<string, string> = {
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
};

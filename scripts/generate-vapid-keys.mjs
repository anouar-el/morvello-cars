// Génère une paire de clés VAPID pour les notifications push.
// Usage : npm run push:keys
// Copiez les trois lignes affichées dans les variables d'environnement du serveur (jamais dans le dépôt).
import webpush from 'web-push';

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log('Ajoutez ces variables à l\'environnement du serveur :\n');
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log('VAPID_SUBJECT=mailto:votre-adresse@exemple.ma\n');
console.log('La clé privée est un secret : ne la partagez pas et ne la commitez pas.');
console.log('Changer ces clés plus tard invalide tous les abonnements : chaque appareil devra réactiver les notifications.');

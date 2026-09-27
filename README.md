# Nūr — lecteur du Coran

Application web moderne et responsive pour lire et écouter le Coran en arabe, avec prononciation et traductions française et anglaise.

## Ce qui est inclus

- page d’accueil et menu moderne regroupant les 114 sourates ;
- pages séparées pour l’accueil, la lecture et les sourates favorites ;
- texte arabe RTL, prononciation, français et anglais ;
- étude mot à mot pour Ḥafṣ, avec sens des mots en anglais ;
- récitation Ḥafṣ par verset et voix Warsh issues du catalogue de minutages de MP3Quran ; la lecture par verset Warsh est proposée quand le minutage de la sourate correspond au texte affiché ;
- export et import d’une sauvegarde personnelle (favoris, progression et préférences) ;
- paramètres centraux pour la voix, la taille du texte, le tajwīd et les langues ;
- audio par verset, recherche, favoris locaux et thèmes clair/sombre ;
- états hors connexion, erreurs explicites, navigation clavier et animations réduites si le système le demande.

## Installation locale

Prérequis : Node.js 22.13 ou plus récent.

```bash
npm install
npm run dev
```

Ouvrez ensuite l’adresse locale affichée. Pour créer une version optimisée :

```bash
npm run build
npm run start
```

## Données et intégrité du texte

Le connecteur principal se trouve dans `lib/quran/adapters/alQuranCloud.ts`. Il charge les éditions identifiées de [AlQuran Cloud](https://alquran.cloud/api) lorsque le réseau est disponible. Les préférences sont enregistrées sur l’appareil.

Le fichier `lib/quran/demo.ts` ne contient qu’un petit échantillon hors ligne, clairement signalé dans l’interface. Il sert à montrer l’application lorsque l’API n’est pas joignable. L’application ne génère jamais de texte coranique.

Pour une mise en production, vérifiez les licences et conditions d’utilisation de chaque édition, ajoutez une stratégie de cache et faites valider les éditions par une autorité compétente. L’architecture `QuranDataSource` permet de remplacer la source sans changer l’interface.

## Confidentialité

Les sourates favorites, le thème et les préférences de lecture sont enregistrés uniquement dans le stockage local du navigateur. Aucun compte ni suivi publicitaire n’est inclus.

## À propos de Warsh

Le mode Warsh utilise le texte de Quranpedia et les enregistrements de [MP3Quran](https://www.mp3quran.net/eng/timing-api). Les traductions complémentaires ne bloquent plus l’affichage du texte si leur service est momentanément indisponible. La synchronisation par verset est activée seulement si les minutages récupérés correspondent au nombre et à l’ordre des versets. Les autres voix restent écoutables en sourate complète.

Les couleurs de tajwīd sont actuellement réservées à Ḥafṣ. Les annotations Warsh expérimentales restent dans `public/data/warsh-tajweed/` à titre d’archive, mais ne sont pas affichées dans le lecteur.

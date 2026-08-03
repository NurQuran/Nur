# Nūr — lecteur du Coran

Application web moderne et responsive pour lire et écouter le Coran en arabe, avec translittération et traductions française et anglaise.

## Ce qui est inclus

- page d’accueil et menu moderne regroupant les 114 sourates ;
- pages séparées pour l’accueil, la lecture et les sourates favorites ;
- texte arabe RTL, translittération, français et anglais ;
- récitation Ḥafṣ par verset et récitation Warsh par sourate, avec Al‑Kouchi (Maroc) ou Al‑Hussary ;
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

Le connecteur principal se trouve dans `lib/quran/adapters/alQuranCloud.ts`. Il charge les éditions identifiées de [AlQuran Cloud](https://alquran.cloud/api) : texte arabe Uthmani ou Warsh, traduction française de noMuhammad Hamidullah, traduction anglaise de Muhammad Asad, translittération et audio du récitateur choisi.

Le fichier `lib/quran/demo.ts` ne contient qu’un petit échantillon hors ligne, clairement signalé dans l’interface. Il sert à montrer l’application lorsque l’API n’est pas joignable. L’application ne génère jamais de texte coranique.

Pour une mise en production, vérifiez les licences et conditions d’utilisation de chaque édition, ajoutez une stratégie de cache et faites valider les éditions par une autorité compétente. L’architecture `QuranDataSource` permet de remplacer la source sans changer l’interface.

## Confidentialité

Les sourates favorites, le thème et les préférences de lecture sont enregistrés uniquement dans le stockage local du navigateur. Aucun compte ni suivi publicitaire n’est inclus.

## À propos de Warsh

AlQuran Cloud ne propose pas d’édition textuelle Warsh. L’application ne renomme donc jamais son texte Ḥafṣ en « Warsh ». Le mode Warsh utilise les enregistrements authentifiés de [MP3Quran](https://www.mp3quran.net/fr/api), tandis que l’interface explique clairement la provenance du texte affiché. Pour un muṣḥaf Warsh marocain officiel, consultez le [Muṣḥaf Mohammedi numérique](https://almoshaf-almohammadi.ma/).

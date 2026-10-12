# Activer les comptes Nur, Google, Gmail et l’administration

Le code est préparé, mais la connexion Google, les codes e-mail et les statistiques de production ne sont pas actifs avant cette configuration. Le mode invité fonctionne sans clés. Aucun secret n’est enregistré dans Git. Ne transmettez jamais le contenu du JSON ni les secrets dans le chat.

## 1. Préparer Google Cloud

Dans le projet Google Cloud qui possède votre client OAuth :

1. Activez **Gmail API v1**.
2. Gardez un client OAuth de type **Application Web** pour ce serveur Cloudflare.
3. Ajoutez cette **URI de redirection autorisée**, exactement :
   `https://nur.youbianas1.workers.dev/api/auth/google/callback`
4. Configurez l’écran de consentement avec le nom Nur et votre adresse d’assistance. En mode test, ajoutez `support.nurquran@gmail.com` et les comptes utilisés pour vos essais aux utilisateurs de test.
5. Le login des visiteurs demande seulement `openid email profile`. L’autorisation **Gmail** est distincte, réservée à l’administrateur, et demande `openid email https://www.googleapis.com/auth/gmail.send`. Les visiteurs ne donnent pas accès à leur boîte mail.
6. Téléchargez le JSON du client Web dans un dossier privé **hors du dépôt**. Il contient le client ID et le client secret ; une simple clé « API key » ne les remplace pas.

En statut externe **Testing**, le jeton Gmail peut expirer après sept jours. Avant une utilisation durable, suivez les exigences de publication/vérification Google adaptées à votre projet. `gmail.send` est un scope sensible ; ne contournez pas les avertissements pour d’autres utilisateurs. Sources : [expiration des refresh tokens](https://developers.google.com/identity/protocols/oauth2#expiration), [scopes Gmail](https://developers.google.com/workspace/gmail/api/auth/scopes), [OAuth côté serveur](https://developers.google.com/identity/protocols/oauth2/web-server).

## 2. Préparer Cloudflare

Ouvrez un terminal dans le dossier du projet (celui qui contient `package.json`). Vérifiez que vous utilisez le compte Cloudflare qui possède le Worker `nur`.

```powershell
npm ci
npx wrangler login
npx wrangler whoami
npm run accounts:prepare
```

La dernière commande réutilise ou crée la base **nur-accounts**, applique les tables sans supprimer les données existantes, puis renseigne l’identifiant public de la base dans `nur.config.json`. Elle ne publie pas le site. Si plusieurs comptes Cloudflare sont proposés, sélectionnez le propriétaire du Worker avant de continuer. Le fichier `.wrangler/nur-accounts.json` est une configuration technique locale, sans secrets.

## 3. Configurer les secrets, sans les afficher

```powershell
.\scripts\configure-secrets.ps1 -OAuthJsonPath "C:\CHEMIN-PRIVE\client-google.json"
```

Remplacez uniquement le chemin. Le script lit le JSON et envoie directement ses valeurs à Cloudflare. Il demande aussi l’identifiant admin, un **nouveau** mot de passe, un **nouveau** code secret et les trois réponses personnelles. Les saisies sensibles sont masquées, les réponses et mots de passe sont hachés avec un sel aléatoire. Les anciens secrets publiés dans le chat ne doivent pas être réutilisés.

Sans JSON, vous pouvez lancer le même script sans paramètre, puis laisser le client ID vide pour configurer Google plus tard. La connexion Google et Gmail resteront désactivées, mais les secrets admin pourront être préparés.

Secrets créés : `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `ADMIN_PIN_HASH`, `ADMIN_ANSWER_1_HASH`, `ADMIN_ANSWER_2_HASH`, `ADMIN_ANSWER_3_HASH`.

`AUTH_SECRET` existant est conservé : il chiffre le jeton Gmail. Le changer nécessite de réautoriser Gmail. N’écrivez jamais ces valeurs dans `nur.config.json`, `vite.config.ts`, une variable `VITE_*`, un fichier public ou GitHub. Le script peut être relancé si une étape échoue. Si PowerShell bloque le fichier, vérifiez son contenu et utilisez une politique autorisant ce script uniquement selon les règles de votre ordinateur ; ne désactivez pas globalement les protections.

## 4. Construire et publier quand vous êtes prêt

```powershell
npm test
npx tsc --noEmit
npx wrangler deploy --config dist/server/wrangler.json
```

Le `npm test` reconstruit le site avec le bon identifiant D1. La publication vise le Worker `nur` de `nur.config.json` et conserve ses secrets Cloudflare. Vérifiez l’URL et le compte avant de publier. Si vous préférez le déploiement automatique GitHub/Cloudflare, publiez le code et le `nur.config.json` renseigné seulement après avoir configuré la base et les secrets ; le pipeline doit utiliser la construction Vinext et sa configuration `dist/server/wrangler.json`, pas une ancienne configuration sans D1. Les fichiers sous `.wrangler/` ne sont pas à envoyer sur GitHub.

## 5. Obtenir le refresh token Gmail sans le copier

1. Ouvrez `https://nur.youbianas1.workers.dev/admin`.
2. Entrez votre identifiant, nouveau mot de passe, nouveau code secret et la réponse personnelle demandée.
3. Cliquez **Autoriser Gmail**.
4. Choisissez **support.nurquran@gmail.com** et acceptez l’autorisation d’envoi.
5. Au retour, Nur chiffre et conserve le refresh token dans D1. Il n’est ni affiché ni envoyé au navigateur. Le tableau indique que Gmail est autorisé.

Il n’est donc pas nécessaire d’obtenir un refresh token manuellement dans OAuth Playground. Un autre compte Gmail est rejeté. Si Google ne renvoie pas de jeton ou si l’autorisation expire, réessayez le bouton de renouvellement et vérifiez les paramètres Google. `GMAIL_REFRESH_TOKEN` reste supporté comme secret serveur optionnel si vous possédez déjà un jeton ; il n’est pas requis dans ce parcours. Un client Gmail distinct peut également être configuré avec `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET` et la même URI de callback.

## 6. Vérification finale en conditions réelles

- Inscription : landing → Google ou code e-mail → prénom → langue → lecture → ambiance → accueil personnel.
- Inscription par e-mail : l’existence du compte est contrôlée avant l’envoi. Une adresse déjà inscrite reçoit une invitation à se connecter, sans générer de code ni appeler Gmail. Ce contrôle révèle l’existence d’un compte et reste limité en fréquence ; seule la validation du code prouve la possession de l’adresse.
- « Continuer avec Google » depuis l’inscription : crée un compte uniquement s’il est nouveau ; sinon ouvre le compte existant et restaure son nom, ses préférences et sa progression sans refaire la configuration déjà enregistrée.
- Connexion à un compte déjà configuré : Google ou code e-mail → récupération du prénom et des préférences → accueil, sans refaire le tutoriel.
- Mode invité : « Ignorer » fonctionne, favoris/progression restent locaux et export JSON disponible.
- Deux appareils connectés au même compte : favoris, paramètres et progression convergent, sans double comptage des minutes ni restauration des favoris supprimés.
- Rechargement : l’utilisateur déjà configuré arrive directement à son accueil.
- Déconnexion : les dernières modifications sont synchronisées avant de retirer les données du navigateur.
- Connexion admin incorrecte : aucune statistique accessible. Les réponses seules ne permettent pas d’entrer.
- Gmail : tester la réception réelle d’un code, son expiration et le refus d’un code réutilisé.
- Mobile/tablette, français/anglais/arabe et animations réduites : vérifier le rendu et le parcours.

Les tests automatisés simulent Google et Gmail ; ils ne remplacent pas ces essais réels après activation. Les navigateurs bloquant les cookies ou le réseau peuvent empêcher la connexion.

## Données et sécurité

Les analytics montrent les pages vues, les pays et les sourates ouvertes. Les visiteurs sont une **estimation par session et par jour**, pas un compteur exact de personnes. Pas d’IP ni d’identité de compte dans les événements analytics. DNT/GPC sont respectés. Nettoyage quotidien des événements vieux de plus de 365 jours ; les comptes et leur progression restent conservés séparément pour la synchronisation. Pour désactiver la collecte, définissez `ANALYTICS_ENABLED=0` côté Worker.

Le login par code e-mail est une connexion sans mot de passe, **pas une vraie authentification à deux facteurs**. Les questions personnelles demandées pour l’admin sont conservées, mais ne constituent pas un second facteur indépendant ; utilisez un mot de passe fort et un code distinct. Une protection supplémentaire avec Cloudflare Access ou une authentification TOTP pourra être ajoutée séparément. Il n’existe aucun compte admin ni mot de passe par défaut dans le code.

Si des sessions ou secrets sont compromis : révoquez les sessions D1, renouvelez les secrets concernés et réautorisez Gmail si `AUTH_SECRET` change. Le changement du mot de passe/code admin invalide ses anciennes sessions. Le bouton de réinitialisation efface les préférences/progrès synchronisés mais ne supprime pas l’adresse du compte.

Ce changement concerne le projet Web Nur. Une connexion Google native dans l’APK nécessitera une vérification distincte du projet Android et de son callback ; aucun secret Google serveur ne doit être embarqué dans l’APK.

Références : [secrets Workers](https://developers.cloudflare.com/workers/configuration/secrets/), [commandes D1](https://developers.cloudflare.com/d1/wrangler-commands/).

# PILOT-WEB-01 — RUNBOOK RENDER

## 1. Architecture

- Un Render Web Service Node.js, branche `main`.
- Une seule instance applicative.
- Next.js 16, Node.js 24+, pnpm 11.9.0.
- Un disque persistant Render chiffré au repos.
- SQLite et le stockage documentaire local sur ce disque.
- Auth0 comme fournisseur OIDC ; pilote fermé sans auto-provisionnement.
- Aucun PostgreSQL, Redis, worker, microservice ou scaling horizontal.

## 2. Render

Créer manuellement un **Web Service** connecté au dépôt `arnaudotchoumouhme-byte/mentor-platform` :

- Branch : `main`
- Runtime : `Node`
- Region : à valider avant création, au plus près des utilisateurs et conforme aux exigences de données
- Instance count : `1`
- Auto-deploy : désactivé pour le premier déploiement contrôlé ; les déploiements suivants restent soumis à validation
- Pre-deploy command : aucune — elle n’accède pas au disque persistant et aucune migration utilisateur ne doit être implicite

Le premier domaine sera celui attribué par Render : `https://<RENDER-SERVICE-HOST>.onrender.com`. Remplacer ce placeholder partout par l’hôte effectivement attribué avant de configurer Auth0.

Aucun `render.yaml` n’est ajouté : le service n’existe pas encore et les paramètres critiques (nom, région, plan, taille du disque et secrets) exigent une validation humaine dans le Dashboard. La configuration manuelle évite un manifeste incomplet.

## 3. Persistent disk

- Disk mount path : `/opt/render/project/src/persistent`
- `MENTOR_DATA_DIRECTORY` : `/opt/render/project/src/persistent/data`
- Base SQLite : `/opt/render/project/src/persistent/data/mentor.db`
- Stockage documentaire : `/opt/render/project/src/persistent/data/documents`
- Backups contrôlés : `/opt/render/project/src/persistent/backups`

Seuls les chemins sous le point de montage persistent. Donner au processus Render les droits lecture/écriture sur ces répertoires, sans élargir les permissions. Le même disque doit être remonté après chaque restart ou redéploiement.

Le démarrage exécute `scripts/check-persistent-storage.mjs` avant `next start`. En production Render, définir obligatoirement :

```text
MENTOR_REQUIRE_PERSISTENT_STORAGE=1
MENTOR_PERSISTENT_MOUNT_PATH=/opt/render/project/src/persistent
MENTOR_DATA_DIRECTORY=/opt/render/project/src/persistent/data
```

Le contrôle lit `/proc/self/mountinfo`, exige un montage dédié exactement au chemin configuré, refuse `overlay`, `tmpfs` et `ramfs`, vérifie que le répertoire de données est un descendant du montage et contrôle les droits lecture/écriture. Il échoue avant le démarrage HTTP et avant toute ouverture de SQLite. Aucun fallback éphémère n'est autorisé en production Render.

Choisir initialement la plus petite taille offrant une marge suffisante pour la base, les documents, les fichiers WAL temporaires et la rétention des backups. La taille exacte doit être validée après mesure des données, sans ouvrir la base dans cette mission.

## 4. Build et start

Les commandes réutilisent strictement `package.json` :

```text
Build command: corepack enable && pnpm install --frozen-lockfile && pnpm run build
Start command: pnpm run start
```

Configurer `NODE_VERSION=24`. Le champ `packageManager` fixe pnpm à `11.9.0` et `engines.node` exige Node.js 24 ou supérieur.

## 5. Variables d'environnement

Configurer dans Render, jamais dans Git :

| Variable | Valeur attendue | Secret |
|---|---|---|
| `NODE_ENV` | `production` | Non |
| `NODE_VERSION` | `24` | Non |
| `MENTOR_ENABLE_DEMO_DATA` | `0` | Non |
| `MENTOR_DATA_DIRECTORY` | `/opt/render/project/src/persistent/data` | Non |
| `MENTOR_REQUIRE_PERSISTENT_STORAGE` | `1` | Non |
| `MENTOR_PERSISTENT_MOUNT_PATH` | `/opt/render/project/src/persistent` | Non |
| `MENTOR_PILOT_PROVISIONER_SUBJECTS` | subjects Auth0 opérateurs séparés par virgule | Oui côté exploitation |
| `MENTOR_PILOT_OSCE_SESSION_LIMIT` | limite validée | Non |
| `MENTOR_PILOT_AI_REQUEST_LIMIT` | limite validée | Non |
| `MENTOR_PILOT_QUOTA_WINDOW_DAYS` | durée validée, 1–366 | Non |
| `MENTOR_PILOT_AUDIT_KEY` | secret aléatoire de 32 caractères minimum | Oui |
| `AUTH0_DOMAIN` | domaine du tenant Auth0, sans secret | Non |
| `AUTH0_CLIENT_ID` | fourni par l’application Auth0 | Oui côté exploitation |
| `AUTH0_CLIENT_SECRET` | secret Auth0 | Oui |
| `AUTH0_SECRET` | secret hexadécimal de 32 octets pour les cookies | Oui |
| `APP_BASE_URL` | `https://<RENDER-SERVICE-HOST>.onrender.com` | Non |
| `AI_DAILY_BUDGET_CAD` | limite pilote validée humainement | Non |
| `OPENAI_API_KEY` | uniquement si un connecteur OpenAI réel est activé | Oui |

`PORT` est fourni au processus par Render et n’est pas lu directement par le code. Ne pas définir de variable `AUTH0_BASE_URL` ou `AUTH0_ISSUER_BASE_URL` : le SDK installé utilise `APP_BASE_URL` et `AUTH0_DOMAIN`.

`.env.example` contient déjà les placeholders applicatifs requis et ne doit recevoir aucune valeur réelle.

## 6. Auth0

Créer ultérieurement une application Auth0 de type **Regular Web Application** avec :

```text
Application Login URI: https://<RENDER-SERVICE-HOST>.onrender.com/auth/login
Allowed Callback URLs: https://<RENDER-SERVICE-HOST>.onrender.com/auth/callback
Allowed Logout URLs: https://<RENDER-SERVICE-HOST>.onrender.com
Allowed Web Origins: https://<RENDER-SERVICE-HOST>.onrender.com
```

La callback et la route de logout du SDK `@auth0/nextjs-auth0` 4.26.0 sont respectivement `/auth/callback` et `/auth/logout`. Utiliser les scopes OIDC standards minimaux fournis par le SDK ; ne pas ajouter Organizations, RBAC, social login, MFA spécifique ou base de comptes personnalisée.

HTTPS est obligatoire. Conserver les cookies sécurisés et les réglages SameSite sûrs du SDK. `AUTH0_CLIENT_SECRET`, `AUTH0_SECRET` et les tokens ne doivent apparaître ni côté client, ni dans les logs, ni dans SQLite.

## 7. Health check

Configurer Render avec :

```text
Health Check Path: /api/health
```

Le contrat actuel retourne une réponse HTTP de succès avec `status`, `version`, `environment` et `traceId`. Il n’expose ni secret, ni chemin de données, ni donnée utilisateur.

`/api/health` reste la liveness Render. Après démarrage, vérifier également `/api/readiness` : il retourne HTTP 200 seulement si le Persistent Disk, SQLite, le schéma courant, l'absence de migration en attente, Auth0 et les modules indispensables sont prêts. Une réponse 503 contient uniquement des statuts non sensibles et un `traceId`; utiliser ce dernier dans les logs structurés.

## 8. Regle SQLite mono-instance

**INSTANCE COUNT = 1.**

**NE PAS augmenter le nombre d’instances applicatives tant que SQLite est la persistence active du pilote.** Interdiction de scaling horizontal, de plusieurs instances partageant le même fichier ou de writers indépendants. Aucun verrou distribué n’est nécessaire.

## 9. Backup et restauration

Réutiliser exclusivement `SqliteBackupService` et l’activation contrôlée :

1. Avant toute opération critique : `ControlledMigrationActivation.prepare()` crée un backup sous `/opt/render/project/src/persistent/backups`, le vérifie et lie son manifeste au plan.
2. Vérifier le statut `VERIFIED`, le checksum, la version et `integrity_check` avant autorisation.
3. Exécuter une migration uniquement après autorisation humaine exacte.
4. Conserver une sauvegarde avant le premier transfert, avant chaque migration et périodiquement avec rétention limitée.
5. En récupération, appeler uniquement `SqliteBackupService.restoreToStaging()` vers un nouveau fichier du volume.
6. Valider le staging avant toute décision humaine de remplacement de la base active. Ne jamais restaurer automatiquement sur la base active.

Les snapshots quotidiens Render complètent ce mécanisme mais ne remplacent pas les backups applicatifs vérifiés.

### Attachement à un service déjà démarré sans disque

1. Placer le service en maintenance et stopper les écritures.
2. Créer un backup SQLite cohérent avec `SqliteBackupService`, puis vérifier manifeste, checksum, version, empreinte et `integrity_check`.
3. Exporter le package vérifié hors de l'instance : le répertoire overlay actuel sera masqué ou perdu lors de l'attachement.
4. Dans **Render Dashboard → Web Service → Disks → Add Disk**, choisir `/opt/render/project/src/persistent` et une taille couvrant base, WAL, documents, staging et rétention.
5. Configurer les trois variables de persistance ci-dessus puis redéployer.
6. Dans le Shell runtime, vérifier `findmnt /opt/render/project/src/persistent`, `df -h /opt/render/project/src/persistent` et l'absence de type `overlay`.
7. Transférer le package sous `persistent/backups`, restaurer uniquement avec `restoreToStaging()` vers `persistent/recovery/<timestamp>/mentor-staging.db`, puis revérifier.
8. Toute mise en place au chemin actif exige l'arrêt du service et une autorisation humaine distincte. Ne jamais restaurer automatiquement.
9. Conserver une copie vérifiée hors du disque Render ; les snapshots Render ne remplacent pas le backup SQLite applicatif.

## 9 bis. MIG-0013 et provisioning du premier compte

MIG-0013 est additive, v12 vers v13, et crée uniquement `pilot_account_provisioning_audit`. MIG-0012 reste inchangée. L'activation de production suit exclusivement `ControlledMigrationActivation.prepare()`, backup vérifié, autorisation humaine exacte, `execute()` et post-validation.

Après validation de la base en version 13 et du montage persistant :

1. Créer l'utilisateur opérateur et l'utilisateur pilote dans Auth0, sans token dans SQLite.
2. Ajouter le subject de l'opérateur à `MENTOR_PILOT_PROVISIONER_SUBJECTS` et définir les limites, fenêtre et clé d'audit.
3. Se connecter à `/auth/login` avec l'opérateur allowlisté.
4. Dans la console du navigateur sur le même origin, exécuter en remplaçant uniquement le subject cible :

```javascript
await fetch('/api/admin/pilot/accounts', {
  method: 'POST',
  headers: {'content-type': 'application/json'},
  body: JSON.stringify({oidcSubject: 'auth0|SUBJECT_CIBLE'})
}).then(async response => ({status: response.status, body: await response.json()}))
```

Le cookie Auth0 reste géré par le navigateur et ne doit jamais être copié dans une commande ou un journal. La réponse attendue est `201/CREATED`, ou `200/ALREADY_PROVISIONED` lors d'une répétition. Un compte `DISABLED` reste refusé. Vérifier ensuite `/api/state` à `200`, le dashboard vide, les deux quotas et l'événement d'audit dédié.

## 10. Premier deploiement

À exécuter dans une mission distincte :

1. Créer le Web Service Render et connecter le dépôt.
2. Sélectionner `main`, Node et une seule instance.
3. Définir les commandes build/start ci-dessus.
4. Créer le disque persistant et monter `/opt/render/project/src/persistent`.
5. Définir les variables non secrètes et ajouter les secrets dans Render.
6. Relever l’hôte `onrender.com` réellement attribué.
7. Remplacer `<RENDER-SERVICE-HOST>` dans `APP_BASE_URL` et la configuration Auth0.
8. Vérifier les callbacks Auth0 exacts.
9. Déployer sans transférer la base utilisateur et sans provisionner de pilote.
10. Vérifier `/api/health` et les logs expurgés.
11. Effectuer les smoke tests administratifs ci-dessous.

## 11. Smoke tests

- `/api/health` répond sans secret ni donnée utilisateur.
- Une requête non authentifiée est refusée sur les routes protégées.
- Un subject Auth0 sans `Account` est refusé.
- Un compte `DISABLED` est refusé.
- Deux comptes provisionnés synthétiques ne peuvent pas accéder aux ressources l’un de l’autre.
- Un quota absent ou épuisé bloque l’opération correspondante.
- Le ledger enregistre uniquement les métadonnées prévues, sans contenu sensible.
- Les logs ne contiennent ni token, cookie, secret, prompt ni donnée utilisateur.

## 12. Transfert de base — operation separee

Ne pas copier `data/mentor.db` pendant la préparation ou le premier déploiement vide. Un transfert éventuel de la base v12 est une opération critique distincte : arrêt applicatif, backup local vérifié, checksum, transfert contrôlé vers un staging distant, permissions minimales, `integrity_check`, concordance de version/historique, puis décision humaine avant activation. Aucun démarrage public ne doit précéder cette validation.

## 13. Rollback

- Échec de build : conserver la dernière révision saine ; ne toucher ni au disque ni à SQLite.
- Échec avant transfert : supprimer ou arrêter le service sans donnée utilisateur.
- Échec après transfert : arrêter l’instance, conserver la base active et les backups, restaurer uniquement vers staging, comparer et demander une décision humaine.
- Ne jamais relancer une migration à l’aveugle ni remplacer automatiquement la base active.

## 14. Arret du pilote

1. Fermer l’accès ou arrêter l’instance.
2. Créer et vérifier un dernier backup.
3. Conserver la base, les backups et les journaux nécessaires selon la rétention validée.
4. Révoquer les secrets Auth0/Render si le pilote est terminé.
5. Ne supprimer le disque qu’après validation humaine et preuve de récupération disponible.

## 15. Limites connues

- Une seule instance implique une indisponibilité pendant certains redémarrages ou incidents.
- SQLite et le disque local ne fournissent pas de haute disponibilité multi-instance.
- Les snapshots Render ne prouvent pas seuls la cohérence applicative ; les backups vérifiés restent obligatoires.
- Les quotas sont provisionnés par compte ; aucun billing ni dashboard analytics n’est inclus.
- Le domaine personnalisé, le transfert de la base v12 et l’ouverture aux utilisateurs sont hors de cette préparation.

Question finale : « Avons-nous ajouté uniquement ce qui est nécessaire pour héberger une instance Next.js + SQLite persistante sur Render ? » **Oui.**

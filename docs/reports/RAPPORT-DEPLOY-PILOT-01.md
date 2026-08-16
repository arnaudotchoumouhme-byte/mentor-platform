# RAPPORT DEPLOY-PILOT-01 — PREPARATION DU PILOTE FERME

## Objectif et perimetre

Préparer le déploiement contrôlé de PILOT-WEB-01 pour 4 à 20 utilisateurs, sans déployer, sans provisionner de compte et sans toucher à la base utilisateur. La question à résoudre est : comment déployer simplement, sûrement et de manière réversible une application Next.js Node persistante, sur une instance unique et avec un fichier SQLite placé sur un volume durable chiffré ?

La solution minimale confirmée reste : un service Node.js, une instance, un domaine HTTPS, un fournisseur Auth0, un volume durable et le mécanisme de sauvegarde SQLite existant.

## Etat Git et base utilisateur

- Branche : `main`.
- HEAD : `6100fd443a7474b885196af91178c73b139215ae`.
- `main` ↔ `origin/main` : `0 0` au preflight.
- Aucun changement suivi non commité et index vide avant cette documentation.
- MIG-0012 a déjà été activée séparément par le mécanisme contrôlé ; la base utilisateur est en version 12 selon le rapport d’activation précédent.
- `data/mentor.db` n’a pas été ouverte, interrogée ou modifiée pendant cette mission.

## Besoins confirmes

- Runtime Node.js 24 ou supérieur, avec `pnpm run build` puis `pnpm run start`.
- Une seule instance applicative stateful ; aucun scaling horizontal.
- Volume persistant chiffré au niveau de l’hébergeur.
- `MENTOR_DATA_DIRECTORY` doit désigner un chemin absolu situé sur ce volume ; la base active sera `<MENTOR_DATA_DIRECTORY>/mentor.db`.
- Variables d’environnement et secrets gérés côté serveur par l’hébergeur.
- HTTPS, domaine stable et health check HTTP `/api/health`.
- Sauvegardes vérifiées via `SqliteBackupService`, avec restauration préalable vers un nouveau fichier staging grâce à `restoreToStaging()`.
- Auth0 comme fournisseur OIDC, sans inscription publique ni auto-provisionnement.

## Choix d'hebergeur

Le choix humain est désormais **Render** : un Web Service Node.js payant, une instance et un disque persistant chiffré au repos. La configuration opérationnelle est documentée dans `docs/deployment/PILOT-WEB-DEPLOYMENT.md`. Aucun service Render n’a été créé.

### Option A — Render

- Simplicité : élevée ; Web Service Node, secrets, domaine, health check et disque persistant sont configurables dans le même service.
- Coût relatif : faible à modéré, mais un service payant est obligatoire pour attacher un disque persistant.
- Volume : disque persistant SSD, chiffré au repos, avec snapshots quotidiens automatiques.
- Limites : seul le chemin monté persiste ; le disque impose une instance unique et ne convient pas au scaling horizontal du pilote SQLite.
- Source : [Render — Persistent Disks](https://render.com/docs/disks) et [Render — Web Services](https://render.com/docs/web-services).

### Option B — Fly.io

- Simplicité : modérée ; une Machine et un Fly Volume local satisfont directement le modèle stateful.
- Coût relatif : faible à modéré, facturation séparée de la Machine, du volume et des snapshots.
- Volume : volume local persistant attaché à une seule Machine ; snapshots quotidiens activés par défaut sur les nouveaux volumes.
- Limites : le volume n’est pas répliqué automatiquement ; une Machine et un volume uniques impliquent une indisponibilité possible en cas de panne matérielle. La stratégie de backup vérifié est donc indispensable.
- Source : [Fly.io — Volumes](https://fly.io/docs/volumes/overview/) et [Fly.io — Pricing](https://fly.io/docs/about/pricing/).

### Décision

**Render est validé** pour ce pilote fermé : son service Web payant avec disque persistant, secrets, HTTPS et health check demande moins de configuration opérateur. La configuration reste manuelle afin de ne pas figer dans `render.yaml` un nom, une région, un plan ou une taille de disque non encore créés.

## Configuration minimale deja disponible

`.env.example` contient déjà tous les placeholders réellement utilisés :

- `AUTH0_DOMAIN`
- `AUTH0_CLIENT_ID`
- `AUTH0_CLIENT_SECRET`
- `AUTH0_SECRET`
- `APP_BASE_URL`
- `MENTOR_DATA_DIRECTORY`
- `MENTOR_ENABLE_DEMO_DATA`
- `OPENAI_API_KEY`
- `AI_DAILY_BUDGET_CAD`

`NODE_ENV` est lu par l’application mais fourni normalement par le runtime de production. `PORT` n’est pas lu directement par le code et peut être fourni au processus `next start` par l’hébergeur. Aucun placeholder ne manque ; `.env.example` reste inchangé.

## Garde-fous a appliquer apres le choix

- `MENTOR_ENABLE_DEMO_DATA=0` en production.
- `MENTOR_DATA_DIRECTORY` sur le volume durable, jamais sur un répertoire éphémère.
- Propriétaire du volume : uniquement l’utilisateur système exécutant le processus ; permissions minimales lecture/écriture pour ce compte.
- Au restart, la même instance remonte le même volume et retrouve `mentor.db`, ses fichiers SQLite associés, le stockage et les backups.
- **NE PAS augmenter le nombre d’instances applicatives tant que SQLite est la persistence active du pilote.**
- Sauvegarde vérifiée avant le premier déploiement de données et avant chaque migration ; sauvegarde périodique à rétention limitée ; contrôle d’intégrité ; restauration uniquement vers staging avant toute décision de remplacement actif.
- `/api/health` est suffisant pour confirmer que l’application répond : il expose uniquement un statut, une version, un environnement et un `traceId`, sans secret ni donnée utilisateur.
- Auth0 : application Web régulière, base URL HTTPS stable, callbacks/logout/web origins dérivés du domaine final, scopes OIDC minimaux (`openid profile email` si l’email est réellement nécessaire), sans Organizations ni RBAC.
- Cookies sécurisés en production et valeurs sûres du SDK officiel ; aucun secret ou token exposé au client ou aux logs.
- Provisionnement manuel seulement : utilisateur Auth0 existant, subject vérifié, `Account` explicitement `ACTIVE`, `learnerId` associé, quotas par compte configurés, puis test d’accès et d’isolation.
- Le ledger existant couvre feature, account, provider/model, usage, coût estimé, durée, succès et `trace_id`. Aucun dashboard supplémentaire n’est requis.

## Checklist pre-deploiement future

- Secrets configurés hors Git ; HTTPS actif ; callbacks Auth0 exacts.
- Compte inconnu et compte `DISABLED` refusés ; accès cross-user refusé.
- Quotas provisionnés ; logs expurgés ; health check OK.
- Volume durable chiffré monté ; backups vérifiés actifs ; une seule instance.
- Sauvegarde préalable et procédure `restoreToStaging()` testée avant ouverture du pilote.

## Fichiers et dossiers

- Créé dans la phase Render : `docs/deployment/PILOT-WEB-DEPLOYMENT.md`.
- Modifié : `docs/reports/RAPPORT-DEPLOY-PILOT-01.md`.
- Supprimés : aucun fichier.
- Exclus : `.tmp-migration-runner/`, `backups/`, `DOCS1/`, `dossier evolution/`, `mentor-platform-restaure/`, `docs/reports/RAPPORT-ETAT-DEVELOPPEMENT.md` et `data/`.

## Controles et limites

- Commandes exécutées : preflight Git, lecture ciblée des fichiers autorisés, recherche ciblée des références d’hébergement et vérification des documentations officielles Render/Fly.io.
- Tests/build : non exécutés, car aucun code ni fichier runtime n’a changé.
- Déploiement, compte externe, secret réel, migration, provisioning et merge : non effectués. Le commit documentaire initial `611a97f` a été poussé avant la phase Render ; le commit de configuration Render reste local.
- Problème rencontré : hébergeur initialement absent des décisions du dépôt. Résolution : choix humain de Render et création d’un runbook manuel minimal.
- Dette restante : créer le service pour connaître son hôte exact, puis valider la région, le plan, la taille du volume, la rétention et les paramètres Auth0 avant le premier déploiement.

## Simplicite et verdict

Question de revue : « Ce déploiement peut-il être plus simple sans réduire la sécurité ou la capacité à restaurer les données ? » Non : l’approche minimale tient déjà à un service, une instance, un volume, un domaine, Auth0 et le backup existant.

Verdict : **VALIDABLE POUR UN PREMIER DEPLOIEMENT CONTROLE**, sans transfert de base ni ouverture aux utilisateurs.

Prochaine étape recommandée : valider humainement le runbook Render puis effectuer le premier déploiement sans transférer la base utilisateur ni ouvrir l’accès aux pilotes.

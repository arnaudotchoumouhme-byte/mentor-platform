# RAPPORT PILOT-WEB-01 — PILOTE WEB FERME

## Objectif et périmètre

Implémenter le pilote Web fermé pour 4 à 20 utilisateurs avec Auth0, une instance applicative stateful, SQLite durable/chiffrée au déploiement, comptes provisionnés, ownership serveur, quotas et ledger opérationnel. Aucun contenu clinique, lot suivant ou activation utilisateur de migration n'est inclus.

## Git

- Branche : `feat/pilot-web-01`
- Base : `main` synchronisée après publication du plan `a8728bf`.
- Commit BUILD : à créer localement avec le message `feat(pilot): implement closed web pilot`.
- Push/merge : non effectués.

## Architecture et fonctionnalités réalisées

- Authentification : SDK officiel `@auth0/nextjs-auth0` 4.26.0, middleware Next.js 16 dans `src/proxy.ts`, secrets exclusivement par variables d'environnement.
- Frontière fournisseur : Auth0 reste dans `src/infrastructure/pilot/`; le domaine reçoit uniquement le `subject` OIDC et ne dépend pas du SDK.
- Autorisation : `subject Auth0 -> Account ACTIVE -> learnerId` résolu côté serveur. Les identifiants apprenant envoyés par le client ne servent jamais de preuve d'identité.
- Pilote fermé : aucun auto-provisionnement; comptes inconnus ou `DISABLED` refusés.
- Ownership : Foundation, MCQ, OSCE et Calculations utilisent l'identité serveur. Les sessions MCQ sont liées à leur apprenant; les accès croisés sont refusés.
- Quotas : consommation transactionnelle SQLite, isolation par compte, refus fermé lorsque le quota OSCE est absent ou épuisé.
- Ledger : append-only, métadonnées opérationnelles et coût estimé facultatif; aucun prompt, réponse ou contenu clinique stocké.
- UI : page `/pilot` minimale pour connexion, déconnexion, compte actif et accès refusé; aucun redesign.
- Persistence : ports applicatifs simples et adapters SQLite; aucune infrastructure distribuée ni abstraction prospective.

## Migration

- Migration : `MIG-0012 — Closed Web Pilot Core`, additive, v11 vers v12.
- Ajouts : `accounts`, `usage_quotas`, `usage_ledger`, index associés et `mcq_sessions.learner_id` nullable pour préserver les sessions historiques.
- MIG-0001 à MIG-0011 : aucune modification fonctionnelle; MIG-0001 reçoit uniquement l'enregistrement minimal de MIG-0012 dans le registre global existant.
- Tests : bootstrap vierge v12, v11 vers v12, historique, checksum, intégrité, contraintes, preservation legacy/MCQ/Foundation et chaîne preflight/activation.
- Base utilisateur : `data/mentor.db` n'a pas été ouverte, interrogée, modifiée ou migrée. MIG-0012 n'a été exécutée que sur des bases synthétiques.

## Fichiers créés

- `src/proxy.ts`
- `src/app/pilot/page.tsx`
- `src/app/api/pilot/route.ts`
- `src/app/api/pilot/route.test.ts`
- `src/application/pilot/pilot-core.ts`
- `src/application/pilot/pilot-core.test.ts`
- `src/infrastructure/pilot/auth0.ts`
- `src/infrastructure/pilot/server-pilot.ts`
- `src/infrastructure/pilot/sqlite-pilot-ownership.ts`
- `src/infrastructure/pilot/sqlite-pilot-repository.ts`
- `src/infrastructure/pilot/sqlite-pilot-repository.integration.test.ts`
- `src/infrastructure/database/sqlite/migrations/definitions/mig-0012-closed-web-pilot.ts`
- `src/infrastructure/database/sqlite/migrations/mig-0012-closed-web-pilot.test.ts`
- `docs/reports/RAPPORT-PILOT-WEB-01.md`

## Fichiers modifiés

- `.env.example`
- `package.json`
- `pnpm-lock.yaml`
- `src/app/api/calculations/route.ts`
- `src/app/api/foundation/route.ts`
- `src/app/api/foundation/route.test.ts`
- `src/app/api/mcq/sessions/route.ts`
- `src/app/api/mcq/sessions/route.test.ts`
- `src/app/api/mcq/sessions/mcq-route-contract.test.ts`
- `src/app/api/mcq/sessions/[sessionId]/route.ts`
- `src/app/api/mcq/sessions/[sessionId]/answers/route.ts`
- `src/app/api/mcq/sessions/[sessionId]/complete/route.ts`
- `src/app/api/osce/route.ts`
- `src/app/api/osce/route.test.ts`
- `src/application/calculations/calculations-use-cases.ts`
- `src/infrastructure/database/sqlite/migrations/definitions/mig-0001-core-baseline.ts`
- `src/infrastructure/database/sqlite/migrations/fresh-database-bootstrap.ts`
- `src/infrastructure/database/sqlite/migrations/fresh-database-bootstrap.test.ts`
- `src/infrastructure/database/sqlite/migrations/database-readiness-orchestrator.test.ts`
- `src/infrastructure/database/sqlite/migrations/legacy-baseline-adopter.test.ts`
- `src/infrastructure/database/sqlite/migrations/mig-0002-document-import-journal.test.ts`
- `src/infrastructure/database/sqlite/migrations/mig-0003-source-model.test.ts`
- `src/infrastructure/database/sqlite/migrations/mig-0010-calculations-lab-core.test.ts`
- `src/infrastructure/database/sqlite/migrations/mig-0011-osce-text-core.test.ts`
- `src/infrastructure/database/sqlite/preflight/database-migration-preflight.ts`
- `src/infrastructure/database/sqlite/preflight/database-migration-preflight.test.ts`
- `src/infrastructure/database/sqlite/activation/controlled-migration-activation.test.ts`
- `src/infrastructure/database/sqlite/backup/sqlite-backup-service.test.ts`
- `src/presentation/api/http-error-mapper.ts`

Aucun fichier supprimé.

## Contrôles exécutés et résultats exacts

Toutes les commandes SQLite/runtime ont utilisé `MENTOR_ENABLE_DEMO_DATA=0` et un `MENTOR_DATA_DIRECTORY` absolu sous `C:\Users\otcho\AppData\Local\Temp\`.

- Tests Pilot/API/MIG ciblés : 9 fichiers, 30/30 tests réussis.
- Tests migrations/preflight/activation : 22 fichiers, 157/157 tests réussis.
- `pnpm run typecheck` : réussi avec pnpm 11.19.0 et `tsc --noEmit`.
- `pnpm run lint` : premier passage en échec sur la construction JSX dans un `try/catch`, correction minimale; second passage réussi, 0 erreur et 0 avertissement.
- `pnpm run test` : premier passage 466/467, attente synthétique de backup restée en v11; test isolé corrigé 10/10; relance BUILD réussie, 98 fichiers et 467/467 tests. Après correction d'autorisation, campagne globale réussie avec 99 fichiers et 470/470 tests.
- `pnpm run build` : réussi avec Next.js 16.3.0, 22/22 pages générées, route `/pilot`, API `/api/pilot` et Proxy présents.
- `git diff --check` : réussi; avertissements Git de normalisation LF vers CRLF seulement.

## Problèmes rencontrés et résolution

- Le lanceur `pnpm.cmd` système n'a pas pu vérifier la signature du registre (`fetch failed`). Le runtime pnpm 11.19.0 fourni par l'environnement local a exécuté les gates verrouillés.
- Le bootstrap v12 exigeait l'ajout des tables Pilot à la validation canonique et la mise à jour des attentes de version courante dans les tests historiques.
- ESLint refusait du JSX construit dans un `try/catch`; l'état d'identité est désormais résolu avant le rendu.
- Le test de restauration déclarait encore un manifeste v11; son attente synthétique a été alignée sur v12.
- La revue finale a démontré que `/api/actions`, `/api/ai`, `/api/coach`, `/api/documents`, `/api/search` et `/api/state` reposaient encore uniquement sur le middleware Auth0 et contournaient l'autorisation métier du pilote. Toutes ces surfaces, y compris la lecture `/api/documents/[id]`, appellent désormais `requirePilotIdentity()` et refusent les comptes absents ou désactivés. Les corpus Documents/Search et l'état legacy restent globaux, sans ownership artificiel. `/api/ai` consomme le quota `AI_REQUEST` et écrit un événement sans contenu dans le ledger.

## Correction d'autorisation API

- Frontière appliquée : `Auth0 subject -> Account ACTIVE -> learnerId serveur`.
- Routes corrigées : `/api/actions`, `/api/ai`, `/api/coach`, `/api/documents`, `/api/documents/[id]`, `/api/search`, `/api/state`.
- Tests négatifs : absence de compte ou compte désactivé refusé sur chaque surface; compte actif accepté selon le contrat; quota/ledger AI invoqués uniquement après résolution de l'identité.
- Résultats : tests ciblés 29/29, `tsc --noEmit` réussi, ESLint ciblé réussi sans sortie, tests globaux 470/470.
- Build non relancé : aucune modification structurelle Next.js; seules les routes, leurs tests, le helper de metering existant et ce rapport ont changé.

## Décisions techniques et simplicité

Auth0 est encapsulé dans un seul adapter. Un service applicatif, un repository SQLite et un petit adapter d'ownership suffisent; aucun RBAC, Organization, inscription publique, microservice, event bus, cache distribué, billing ou PostgreSQL n'a été ajouté. Revue obligatoire : la solution ne peut pas être simplifiée davantage sans perdre l'isolation multi-utilisateur, le quota atomique ou la traçabilité demandée.

## Sécurité, confidentialité et IA

- Aucun token Auth0 ni secret n'est persisté ou loggé.
- `.env.example` contient uniquement des placeholders.
- Les scopes restent ceux nécessaires à la session OIDC standard; aucune fonctionnalité Auth0 avancée.
- Les erreurs internes sont masquées et les réponses portent un `trace_id`.
- Le ledger ne stocke aucun contenu sensible.
- Aucune nouvelle logique IA ni prompt n'a été introduit; les champs provider/model/coût sont uniquement une observabilité opérationnelle nullable.

## Dette technique restante

- `TECH-DEBT-MIG-REGISTRY` demeure : le registre global est colocalisé avec MIG-0001 et devra être extrait lors d'un refactor contrôlé distinct.
- Le chiffrement du volume SQLite relève de la configuration de l'instance d'hébergement; aucun chiffrement applicatif maison n'est ajouté.

## Éléments volontairement exclus

- `.tmp-migration-runner/`
- `backups/`
- `DOCS1/`
- `dossier evolution/`
- `mentor-platform-restaure/`
- `docs/reports/RAPPORT-ETAT-DEVELOPPEMENT.md`
- `data/`, notamment `data/mentor.db`

## Actions non effectuées

Aucune ouverture ou migration de la base utilisateur, activation MIG-0012, donnée clinique réelle, lot suivant, indexation globale, push, merge, rebase, déploiement ou pull request.

## Verdict et prochaine étape

Verdict : **VALIDABLE**.

Prochaine étape recommandée : effectuer la revue finale ciblée avant intégration.

## Correction du provisioning pilote et persistance Render — 2026-08-18

### Objectif et périmètre

Corriger le blocage du tableau de bord lorsqu'un utilisateur Auth0 authentifié ne possède pas encore de compte pilote, sans auto-inscription publique et sans seed clinique. La correction ajoute un provisioning administratif contrôlé, un audit dédié, des états UI explicites et un garde-fou de persistance Render. Elle ne réalise aucune opération sur Render ni sur une base de production.

### État Git et fichiers

- Branche de travail : `main`, HEAD de départ `04dbb16`.
- Fichiers suivis modifiés : `.env.example`, `docs/deployment/PILOT-WEB-DEPLOYMENT.md`, `docs/reports/RAPPORT-PILOT-WEB-01.md`, `package.json`, `src/app/page.tsx`, `src/hooks/use-state.ts`, `src/infrastructure/config/app-config.test.ts`, `src/infrastructure/config/app-config.ts`, `src/infrastructure/database/sqlite/activation/controlled-migration-activation.test.ts`, `src/infrastructure/database/sqlite/backup/sqlite-backup-service.test.ts`, `src/infrastructure/database/sqlite/migrations/database-readiness-orchestrator.test.ts`, `src/infrastructure/database/sqlite/migrations/definitions/mig-0001-core-baseline.ts`, `src/infrastructure/database/sqlite/migrations/fresh-database-bootstrap.test.ts`, `src/infrastructure/database/sqlite/migrations/fresh-database-bootstrap.ts`, `src/infrastructure/database/sqlite/migrations/legacy-baseline-adopter.test.ts`, `src/infrastructure/database/sqlite/migrations/mig-0002-document-import-journal.test.ts`, `src/infrastructure/database/sqlite/migrations/mig-0003-source-model.test.ts`, `src/infrastructure/database/sqlite/migrations/mig-0010-calculations-lab-core.test.ts`, `src/infrastructure/database/sqlite/migrations/mig-0011-osce-text-core.test.ts`, `src/infrastructure/database/sqlite/migrations/mig-0012-closed-web-pilot.test.ts`, `src/infrastructure/database/sqlite/preflight/database-migration-preflight.test.ts`, `src/infrastructure/database/sqlite/preflight/database-migration-preflight.ts`, `src/infrastructure/pilot/server-pilot.ts`, `src/infrastructure/pilot/sqlite-pilot-repository.integration.test.ts`, `src/infrastructure/pilot/sqlite-pilot-repository.ts`.
- Nouveaux fichiers : `scripts/check-persistent-storage.mjs`, `scripts/check-persistent-storage.test.mjs`, `src/app/api/admin/pilot/accounts/route.ts`, `src/app/api/admin/pilot/accounts/route.test.ts`, `src/application/pilot/pilot-provisioning.ts`, `src/application/pilot/pilot-provisioning.test.ts`, `src/hooks/use-state.test.ts`, `src/infrastructure/database/sqlite/migrations/definitions/mig-0013-pilot-provisioning-audit.ts`, `src/infrastructure/database/sqlite/migrations/mig-0013-pilot-provisioning-audit.test.ts`.
- `src/lib/db.ts` apparaît modifié uniquement à cause de la normalisation LF/CRLF; son hash de contenu est identique à `HEAD` (`6fbeb795d9596bd4d7cf415e0891bdd8f58a91ca`) et il ne contient aucun changement fonctionnel.
- Aucun fichier supprimé, indexé ou commité par cette intervention.

### Fonctionnalités et décisions techniques

- `PilotProvisioningService` reçoit explicitement le `oidc_subject`, génère côté serveur `account_id`, `learner_id`, identifiants de quotas et identifiant d'audit, puis délègue à un repository transactionnel.
- Le repository SQLite exige exactement le schéma v13, utilise une transaction `BEGIN IMMEDIATE`, crée le compte `ACTIVE` et les quotas `OSCE_SESSION`/`AI_REQUEST`, refuse la réactivation implicite d'un compte `DISABLED` et rend une répétition idempotente.
- La route non publique `POST /api/admin/pilot/accounts` exige une session Auth0 et une allowlist d'opérateurs. La réponse n'expose pas le subject. Aucun token, cookie, email ou secret n'est stocké ou journalisé.
- L'audit n'utilise pas `usage_ledger`, réservé à la consommation. MIG-0013 ajoute une table append-only `pilot_account_provisioning_audit` avec fingerprint HMAC de l'opérateur, compte cible, résultat, trace ID et horodatage.
- Le provisioning est impossible avant validation du schéma en version 13.
- La page principale distingue `loading`, `unauthenticated`, `access-denied`, `loaded-empty`, `loaded` et `error`; une réponse 401/403 ne laisse plus le spinner actif.
- Le démarrage de production exécute `scripts/check-persistent-storage.mjs`. Lorsque `MENTOR_REQUIRE_PERSISTENT_STORAGE=1`, il refuse un répertoire hors du mount attendu, un mount absent, en lecture seule ou de type `overlay`/`tmpfs`/`ramfs`. Il n'existe aucun fallback éphémère.
- `MENTOR_ENABLE_DEMO_DATA=0` reste obligatoire sur Render; aucun contenu MCQ, OSCE, Calculations, Canadian Practice ou clinique n'est seedé.

### Migration et base utilisateur

- MIG-0013 : additive v12 vers v13; nouvelle table et nouvel index d'audit seulement.
- MIG-0012 : définition inchangée; aucune modification fonctionnelle historique.
- MIG-0013 a été testée exclusivement sur des bases synthétiques.
- Aucune base Render ou `data/mentor.db` n'a été ouverte, interrogée, modifiée ou migrée. MIG-0013 n'a pas été activée en production.

### Contrôles exécutés

Environnement synthétique : `MENTOR_ENABLE_DEMO_DATA=0`, `MENTOR_DATA_DIRECTORY=C:\Users\otcho\AppData\Local\Temp\mentor-provisioning-final` (ou répertoires temporaires équivalents pour les campagnes précédentes), `MENTOR_REQUIRE_PERSISTENT_STORAGE=0` hors production.

- `tsc --noEmit` : réussi, aucune sortie.
- `eslint .` : réussi, aucune erreur ni avertissement.
- Tests ciblés finaux : 7 fichiers, 23/23 tests réussis, durée 9,61 s.
- Première campagne globale parallèle : 483/486; trois échecs de timeout/attente dans des tests historiques de migration, sans échec fonctionnel du provisioning. Les attentes de version ont été corrigées et la campagne a été sérialisée.
- Campagne globale finale : 104/104 fichiers, 486/486 tests réussis avec `vitest run --maxWorkers=1`, durée 125,66 s.
- Build Next.js 16.3.0 : réussi, 22/22 pages; route `/api/admin/pilot/accounts` générée. Avertissements attendus : configuration Auth0 absente de l'environnement local de build, aucun secret injecté.
- `git diff --check` : réussi; avertissements de normalisation LF vers CRLF uniquement.

### Exploitation Render

- Mount Path du Persistent Disk : `/opt/render/project/src/persistent`.
- `MENTOR_DATA_DIRECTORY=/opt/render/project/src/persistent/data`.
- Avant tout déploiement avec écriture : passer le service en maintenance, produire une sauvegarde cohérente de la base existante, l'exporter hors du filesystem overlay, attacher dans Render Dashboard un Persistent Disk au mount exact, redéployer, puis vérifier `findmnt -T /opt/render/project/src/persistent/data` et `df -h /opt/render/project/src/persistent/data` avant restauration contrôlée.
- La restauration doit d'abord utiliser `SqliteBackupService.restoreToStaging()` vers un nouveau fichier; le remplacement de la base active exige une décision humaine distincte.
- Après activation contrôlée de MIG-0013 et validation v13, un opérateur Auth0 allowlisté appelle la route depuis une session même origine avec `{ "oidcSubject": "auth0|..." }`. Aucun cookie ou token n'est copié dans une commande ou un journal.
- La procédure complète, les conditions d'arrêt et les vérifications sont consignées dans `docs/deployment/PILOT-WEB-DEPLOYMENT.md`.

### Variables Render supplémentaires

- `MENTOR_ENABLE_DEMO_DATA=0`
- `MENTOR_DATA_DIRECTORY=/opt/render/project/src/persistent/data`
- `MENTOR_REQUIRE_PERSISTENT_STORAGE=1`
- `MENTOR_PERSISTENT_MOUNT_PATH=/opt/render/project/src/persistent`
- `MENTOR_PILOT_PROVISIONER_SUBJECTS=<subjects Auth0 opérateurs séparés selon la syntaxe documentée>`
- `MENTOR_PILOT_OSCE_SESSION_LIMIT=<entier positif>`
- `MENTOR_PILOT_AI_REQUEST_LIMIT=<entier positif>`
- `MENTOR_PILOT_QUOTA_WINDOW_DAYS=<entier positif>`
- `MENTOR_PILOT_AUDIT_KEY=<secret aléatoire fort, au moins 32 caractères>`

### Éléments exclus et actions non effectuées

Restent hors périmètre et hors commit : `.tmp-migration-runner/`, `backups/`, `DOCS1/`, `dossier evolution/`, `mentor-platform-restaure/`, `docs/reports/RAPPORT-ETAT-DEVELOPPEMENT.md` et `data/`. Aucun déploiement, attachement de disque, provisioning réel, migration réelle, seed clinique, indexation Git, commit, push, merge ou pull request n'a été effectué.

### Dette, risques et verdict

- Le Persistent Disk doit être attaché et vérifié avant toute écriture de production; le garde-fou bloque volontairement le démarrage sinon.
- L'activation de MIG-0013 et le provisioning du premier compte restent deux opérations humaines séparées et contrôlées.
- `TECH-DEBT-MIG-REGISTRY` demeure inchangée.

Verdict de l'implémentation locale : **VALIDABLE**, sous réserve d'une revue du diff puis de l'attachement vérifié du Persistent Disk et de l'activation contrôlée séparée de MIG-0013.

## Extension transversale de diagnosticabilité — 2026-08-18

### Objectif

Rendre les défaillances runtime immédiatement classifiables et corrélables, et garantir qu'aucune erreur HTTP ou réseau terminale ne reste masquée par `Loading`.

### Réalisation

- Contrat d'erreur commun : `code`, `message`, `traceId`, `retriable`; même trace dans le header `x-trace-id`, le corps sûr et le log JSON serveur.
- `AppError` expose maintenant `retriable`; le mapper distingue configuration, Auth0, DB, migrations, stockage et quotas.
- Frontière API structurée avec redaction centralisée et événement terminal `failure`.
- États UI : `loading`, `unauthenticated`, `access-denied`, `conflict`, `quota-exceeded`, `loaded-empty`, `loaded`, `network-error`, `server-error`.
- Timeout client explicite de 10 secondes par `AbortController`; toutes les requêtes `fetch` des pages clientes passent par cette frontière. Chaque page utilisant le composant `Loading` reçoit désormais l'état terminal partagé et ne peut plus conserver le spinner après 401, 403, 409, 429, 5xx ou timeout.
- Error Boundaries locale et globale avec référence support non sensible.
- `/api/health` reste une liveness. `/api/readiness` effectue uniquement des contrôles en lecture seule et retourne 200 si le stockage persistant, SQLite, le schéma v13, l'absence de migration, Auth0 et les composants indispensables sont prêts; sinon 503.
- Validation fail-fast des variables Auth0 et provisioning sur Render production.

### Codes ajoutés

`DB_STARTUP_FAILED`, `DB_NOT_READY`, `DB_SCHEMA_OUTDATED`, `DB_SCHEMA_AHEAD`, `DB_MIGRATION_HISTORY_INVALID`, `DB_QUOTA_UPDATE_FAILED`, `FS_PERSISTENT_STORAGE_NOT_MOUNTED`, `CFG_AUTH0_INCOMPLETE`, `CFG_PILOT_PROVISIONING_INCOMPLETE`, `AUTH_SESSION_UNAVAILABLE`, `STATE_LOAD_FAILED`, `NET_REQUEST_TIMEOUT`, `NET_REQUEST_FAILED` et `RUNTIME_NOT_READY`.

### Tests et résultats

- Typecheck : réussi.
- ESLint complet : réussi, aucune erreur ni avertissement.
- Campagne ciblée initiale diagnostic/API : 11 fichiers, 54/54 tests réussis.
- Recontrôle ciblé final après généralisation du timeout client : 4 fichiers, 12/12 tests réussis, durée 4,95 s.
- Première campagne globale : 107 fichiers, 497/502 tests; cinq attentes historiques de corps d'erreur ne contenaient pas encore `traceId` et `retriable`. Les tests contractuels ont été alignés sans modifier le comportement métier.
- Campagne globale intermédiaire : 107/107 fichiers, 502/502 tests réussis, durée 117,46 s, un seul worker.
- Campagne globale finale après généralisation du timeout client : 108/108 fichiers, 504/504 tests réussis, durée 131,93 s, un seul worker.
- Build Next.js 16.3.0 : réussi, 22/22 pages; `/api/readiness` présente. Avertissements Auth0 attendus dans l'environnement local sans secrets.

### Runbooks

- Mis à jour : `docs/runbooks/RUN-APP-START.md`, `docs/deployment/PILOT-WEB-DEPLOYMENT.md`.
- Ajoutés : `docs/runbooks/RUN-DB.md`, `docs/runbooks/RUN-BACKUP.md`, `docs/runbooks/RUN-AI.md`, `docs/runbooks/RUN-DEPLOY.md`.

### Sécurité et exploitation

La readiness n'expose ni secret, token, cookie, email, subject Auth0, chemin de données, requête SQL ni donnée utilisateur. Elle n'appelle aucun fournisseur externe et n'exécute aucune écriture, migration, bootstrap ou seed. Aucune opération Render ou base de production n'a été réalisée.

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
- `pnpm run test` : premier passage 466/467, attente synthétique de backup restée en v11; test isolé corrigé 10/10; relance globale réussie, 98 fichiers et 467/467 tests.
- `pnpm run build` : réussi avec Next.js 16.3.0, 22/22 pages générées, route `/pilot`, API `/api/pilot` et Proxy présents.
- `git diff --check` : réussi; avertissements Git de normalisation LF vers CRLF seulement.

## Problèmes rencontrés et résolution

- Le lanceur `pnpm.cmd` système n'a pas pu vérifier la signature du registre (`fetch failed`). Le runtime pnpm 11.19.0 fourni par l'environnement local a exécuté les gates verrouillés.
- Le bootstrap v12 exigeait l'ajout des tables Pilot à la validation canonique et la mise à jour des attentes de version courante dans les tests historiques.
- ESLint refusait du JSX construit dans un `try/catch`; l'état d'identité est désormais résolu avant le rendu.
- Le test de restauration déclarait encore un manifeste v11; son attente synthétique a été alignée sur v12.

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

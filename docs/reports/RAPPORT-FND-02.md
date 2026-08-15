# RAPPORT FND-02 — CANADIAN PRACTICE CORE

## Objectif et périmètre

Implémentation du noyau Canadian Practice : contrats juridictionnels Canada/Ontario, versions immuables de règles, persistence SQLite, MIG-0008 additive, lectures applicatives, API GET minimale, provenance et observabilité. Aucun contenu réglementaire réel, seed officiel, donnée personnelle, UI, FND-03 ou OSCE n'est inclus.

Branche : `feat/fnd-02-canadian-practice-core`.

## Fichiers

Phase 1 créée ou adaptée :

- `src/domain/canadian-practice/canadian-practice.ts`
- `src/domain/canadian-practice/canadian-practice.test.ts`
- `src/domain/canadian-practice/index.ts`
- `src/application/canadian-practice/canadian-practice-ports.ts`
- `src/infrastructure/canadian-practice/sqlite-canadian-practice-repository.ts`
- `src/infrastructure/canadian-practice/sqlite-canadian-practice-repository.integration.test.ts`
- `src/infrastructure/database/sqlite/migrations/definitions/mig-0008-canadian-practice-core.ts`
- `src/infrastructure/database/sqlite/migrations/mig-0008-canadian-practice-core.test.ts`
- `src/infrastructure/database/sqlite/migrations/definitions/mig-0001-core-baseline.ts` — ajout minimal au registre seulement
- `src/infrastructure/database/sqlite/migrations/fresh-database-bootstrap.ts`
- `src/infrastructure/database/sqlite/preflight/database-migration-preflight.ts`

Phase 2 créée ou adaptée :

- `src/application/canadian-practice/canadian-practice-queries.ts`
- `src/application/canadian-practice/canadian-practice-queries.test.ts`
- `src/app/api/canadian-practice/route.ts`
- `src/app/api/canadian-practice/route.test.ts`
- `src/infrastructure/canadian-practice/server-canadian-practice.ts`
- `src/presentation/api/http-error-mapper.ts`
- tests migration/activation/backup/preflight existants adaptés à la cible 8 : `controlled-migration-activation.test.ts`, `sqlite-backup-service.test.ts`, `database-readiness-orchestrator.test.ts`, `fresh-database-bootstrap.test.ts`, `legacy-baseline-adopter.test.ts`, `mig-0002-document-import-journal.test.ts`, `mig-0003-source-model.test.ts`, `mig-0007-foundation-academy-core.test.ts`, `database-migration-preflight.test.ts`.
- `docs/reports/RAPPORT-FND-02.md`

Aucun fichier supprimé. Les helpers temporaires de génération de base synthétique ont été supprimés après usage.

## Architecture et décisions

- Domaine pur : `FEDERAL` exige `province=null`; `PROVINCIAL` exige `ON`; aucune autre province configurée.
- `PracticeRule` référence obligatoirement un `LearningObjective` du bloc Foundation `CAN`.
- `PracticeRuleVersion` porte source, version, vérification, période d'effet, statut et avertissement d'indépendance.
- Historique insert-only; aucune API d'update destructif; règles expirées, DRAFT ou RETIRED exclues de la résolution active.
- Réutilisation de `Source`/`SourceVersion`, Foundation, `AppError`, mapper HTTP, trace ID et structured logger.
- API dynamique Node.js `GET /api/canadian-practice`; aucune UI et aucune dépendance ajoutée.

## Migration

MIG-0008 est additive `v7 → v8`. Elle crée `canadian_practice_rules` et `canadian_practice_rule_versions`, avec FKs restrictives, checks fermés, unicité de version et indexes de résolution/source. MIG-0001 ne change que par l'enregistrement minimal de MIG-0008 dans le registre global actuellement colocé; MIG-0002 à MIG-0007 restent fonctionnellement inchangées et leurs checksums ne sont pas modifiés. MIG-0008 a été exécutée uniquement sur bases synthétiques.

## Observabilité, sécurité et confidentialité

Événements : `canadian_practice.rule_version_loaded`, `canadian_practice.rule_query_completed`, `canadian_practice.rule_query_rejected`. `trace_id` est résolu à la frontière et propagé. Les logs ne contiennent que les IDs et métadonnées autorisés; ni résumé complet, document, secret, PII ou donnée apprenant. Validation fail-closed, SQL paramétré, erreurs internes masquées. Aucune télémétrie externe et aucune donnée personnelle ajoutée.

## Commandes et résultats exacts

- Tests phase 1 : `.\node_modules\.bin\vitest.cmd run src/domain/canadian-practice/canadian-practice.test.ts src/infrastructure/canadian-practice/sqlite-canadian-practice-repository.integration.test.ts src/infrastructure/database/sqlite/migrations/mig-0008-canadian-practice-core.test.ts` — 3/3 fichiers, 9/9 tests réussis.
- Tests phase 2 : `.\node_modules\.bin\vitest.cmd run src/application/canadian-practice/canadian-practice-queries.test.ts src/app/api/canadian-practice/route.test.ts src/infrastructure/canadian-practice/sqlite-canadian-practice-repository.integration.test.ts src/presentation/api/http-error-mapper.test.ts` — 4/4 fichiers, 13/13 tests réussis.
- Typecheck initial : `.\node_modules\.bin\tsc.cmd --noEmit` — échec sur une inférence de littéraux dans une fixture Ontario; correction typée minimale.
- Typecheck relancé : même commande — réussi, aucune sortie.
- Lint : `.\node_modules\.bin\eslint.cmd .` — réussi, aucune sortie.
- Tests globaux initialement : `.\node_modules\.bin\vitest.cmd run` — 385/405 réussis; 20 assertions historiques encore ciblées sur v7.
- Tests globaux après adaptation : 404/405; une attente `toVersion` restait à 7.
- Tests globaux finaux : 83/83 fichiers, 405/405 tests réussis.
- Build initial : `.\node_modules\.bin\next.cmd build` — compilation et TypeScript réussis, collecte interrompue par le garde-fou sur une base par défaut v7; aucune migration exécutée.
- Préparation synthétique finale : `MENTOR_DATA_DIRECTORY=C:\Users\otcho\AppData\Local\Temp\mentor-fnd02-build-20260814-2130`, `MENTOR_ENABLE_DEMO_DATA=0`, puis test bootstrap temporaire — 1/1 réussi, base synthétique v8.
- Build final dans ce contexte : `.\node_modules\.bin\next.cmd build` — réussi, 21/21 pages générées; route `/api/canadian-practice` dynamique présente.
- `git diff --check` — réussi; avertissements Git CRLF informatifs uniquement.

## Problèmes, résolution et dette

- Les tests historiques ont été alignés sur la version courante 8; leurs scénarios « future/ahead » utilisent désormais MIG-0009.
- Le premier build sans environnement temporaire a déclenché le preflight read-only de la base par défaut. Il a refusé MIG-0008, sans écriture. Le build final a ensuite utilisé exclusivement une base synthétique v8.
- Dette existante conservée : `TECH-DEBT-MIG-REGISTRY` — registre global colocé avec MIG-0001, à extraire lors d'un refactor contrôlé futur.
- Contenu réglementaire réel, validation des sources officielles et extensions provinciales restent des travaux futurs soumis à validation humaine.

## État de la base utilisateur

`data/mentor.db` n'a pas été modifiée ni migrée et MIG-0008 n'y a pas été appliquée. Toutefois, le premier build a provoqué une ouverture en lecture seule par le preflight de démarrage; l'exigence « non ouverte » n'est donc pas satisfaite littéralement. La base a été reconnue version 7 par ce preflight, sans changement.

## Incident de lecture seule de la base utilisateur

- `data/mentor.db` a été ouverte accidentellement en lecture seule pendant le preflight déclenché par le premier build.
- Aucune écriture, migration ou modification n'a été effectuée.
- Aucune donnée utilisateur n'a été altérée; l'impact démontré sur les données est nul.
- Classification : **non-conformité procédurale non bloquante**.
- Mesure préventive : pour tous les prochains BUILD et tests, définir explicitement un `MENTOR_DATA_DIRECTORY` temporaire avant toute commande susceptible de charger le runtime et empêcher l'ouverture implicite de la base utilisateur hors mission autorisée.
- Décision humaine : **FND-02 accepté avec réserve de procédure**.

## État Git et exclusions

Commit phase 1 : `8db8580 feat(canadian-practice): add fnd-02 domain persistence`. Commit phase 2 : `5e9eb7d feat(canadian-practice): complete fnd-02 core`. Sont volontairement exclus : `.tmp-migration-runner/`, `backups/`, `DOCS1/`, `dossier evolution/`, `mentor-platform-restaure/`, `docs/reports/RAPPORT-ETAT-DEVELOPPEMENT.md`, `data/` et les répertoires temporaires système.

Aucun push, merge, rebase, activation utilisateur, seed réglementaire réel, ajout de dépendance ou travail FND-03 n'a été effectué.

## Verdict et prochaine étape

Verdict : **validable avec réserve de procédure**. La décision humaine classe la lecture seule accidentelle comme non-conformité procédurale non bloquante; aucune écriture, migration ou altération de donnée utilisateur n'a été démontrée. Le code, la migration synthétique et les quality gates sont verts. Prochaine étape recommandée : effectuer la revue finale ciblée et intégrer FND-02 vers `main`.

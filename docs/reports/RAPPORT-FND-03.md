# RAPPORT FND-03 — CALCULATIONS LAB CORE

## Objectif et périmètre

Construire le moteur minimal Calculations Lab Core : exercices gradués et versionnés liés à un `LearningObjective`, unités et dimensions explicites, étapes contrôlées, exactitude numérique, plausibilité, erreurs `ERR-CALC`, erreurs critiques, remédiation et re-test traçables. Branche : `feat/fnd-03-calculations-lab-core`.

## Fichiers créés

- `src/domain/calculations/calculations.ts`
- `src/domain/calculations/index.ts`
- `src/domain/calculations/calculations.test.ts`
- `src/application/calculations/calculations-ports.ts`
- `src/application/calculations/calculations-use-cases.ts`
- `src/application/calculations/calculations-use-cases.test.ts`
- `src/infrastructure/calculations/sqlite-calculations-repository.ts`
- `src/infrastructure/calculations/sqlite-calculations-repository.integration.test.ts`
- `src/infrastructure/calculations/server-calculations.ts`
- `src/app/api/calculations/route.ts`
- `src/app/api/calculations/route.test.ts`
- `src/infrastructure/database/sqlite/migrations/definitions/mig-0010-calculations-lab-core.ts`
- `src/infrastructure/database/sqlite/migrations/mig-0010-calculations-lab-core.test.ts`
- `docs/reports/RAPPORT-FND-03.md`

## Fichiers modifiés

- `src/presentation/api/http-error-mapper.ts`
- `src/infrastructure/database/sqlite/migrations/definitions/mig-0001-core-baseline.ts` — enregistrement minimal de MIG-0010 seulement
- `src/infrastructure/database/sqlite/migrations/fresh-database-bootstrap.ts`
- `src/infrastructure/database/sqlite/preflight/database-migration-preflight.ts`
- `src/infrastructure/database/sqlite/activation/controlled-migration-activation.test.ts`
- `src/infrastructure/database/sqlite/backup/sqlite-backup-service.test.ts`
- `src/infrastructure/database/sqlite/migrations/database-readiness-orchestrator.test.ts`
- `src/infrastructure/database/sqlite/migrations/fresh-database-bootstrap.test.ts`
- `src/infrastructure/database/sqlite/migrations/legacy-baseline-adopter.test.ts`
- `src/infrastructure/database/sqlite/migrations/mig-0002-document-import-journal.test.ts`
- `src/infrastructure/database/sqlite/migrations/mig-0003-source-model.test.ts`
- `src/infrastructure/database/sqlite/migrations/mig-0009-quebec-practice-extension.test.ts`
- `src/infrastructure/database/sqlite/preflight/database-migration-preflight.test.ts`

Aucun fichier supprimé.

## Architecture et fonctionnalités

Le domaine est indépendant de SQLite et Next.js. Il prend en charge `mg`, `g`, `mL` et `L`, avec dimensions `MASS` et `VOLUME`, conversions explicites et rejet fermé des unités inconnues ou incompatibles. L'évaluation sépare les étapes, le calcul numérique, l'unité, la dimension et la plausibilité. Elle produit un résultat structuré, rattache les erreurs à `ERR-CALC`, marque les erreurs critiques et interdit la maîtrise en leur présence.

La remédiation cible `CALCULATIONS_LAB`, `DIMENSIONAL_VERIFICATION` et `TARGETED_PRACTICE`, avec priorité critique lorsque nécessaire. Les tentatives et re-tests conservent la tentative source, la version d'exercice, l'horodatage, le résultat et l'état de résolution. Aucun Learner Model ou moteur FND-04 n'est dupliqué.

L'API minimale `/api/calculations` permet la lecture d'une version d'exercice, la soumission d'une tentative et la préparation d'un re-test. Les UUID, nombres finis et unités sont validés strictement. Les erreurs internes ne sont pas exposées. Les événements structurés `calculations.exercise_loaded`, `calculations.attempt_evaluated` et `calculations.retest_recorded` conservent `trace_id` sans contenu clinique ni donnée personnelle.

## Persistence et MIG-0010

Une persistence dédiée était nécessaire pour conserver les définitions versionnées, étapes, tentatives, observations détaillées et filiations de re-test. MIG-0010 est additive, v9 vers v10, et crée cinq tables : `calculation_exercises`, `calculation_exercise_versions`, `calculation_attempts`, `calculation_observations` et `calculation_retests`, avec FK, contraintes fermées et index d'historique.

MIG-0002 à MIG-0009 ne sont pas modifiées fonctionnellement. MIG-0001 conserve sa définition et son checksum ; seul le registre global colocalisé reçoit MIG-0010. Dette maintenue : `TECH-DEBT-MIG-REGISTRY`.

MIG-0010 a été testée uniquement sur bases synthétiques : bootstrap vierge jusqu'à v10, migration v9 vers v10, préservation legacy/MCQ/Foundation, historique, FK et `integrity_check = ok`. Elle n'a pas été appliquée à la base utilisateur.

## Tests et quality gates

Toutes les commandes susceptibles d'initialiser SQLite ont utilisé `MENTOR_ENABLE_DEMO_DATA='0'` et un `MENTOR_DATA_DIRECTORY` absolu sous `C:\Users\otcho\AppData\Local\Temp`.

- Tests ciblés initiaux : 18/19 ; une fixture Foundation positionnelle invalide a été corrigée avec des colonnes explicites.
- Relance repository isolée : 1/1.
- Tests FND-03 ciblés finaux : 19/19.
- Chaîne migrations/preflight/activation ciblée : 59/59.
- Typecheck initial : échec de narrowing dans la closure de route ; correction locale sans changement fonctionnel.
- Typecheck final : réussi.
- ESLint complet : réussi, aucun avertissement.
- Première campagne globale : 428/429, timeout historique de 5 s dans `ControlledMigrationActivation`.
- Relance isolée avant correction : 15/16, timeout déplacé vers un autre scénario, démontrant le coût environnemental cumulé.
- Timeout de cette suite d'intégration porté à 10 s ; relance isolée : 16/16.
- Gate global affecté relancé : 89/89 fichiers, 429/429 tests réussis.
- Build Next.js : réussi ; TypeScript réussi ; 21/21 pages statiques générées ; route `/api/calculations` présente.
- `git diff --check` : réussi. Les avertissements Git LF vers CRLF ne sont pas des erreurs de diff.

## Base utilisateur et sécurité

`data/mentor.db` n'a été ni ouverte, ni interrogée, ni modifiée pendant le BUILD. Sa dernière version connue est 9, mais elle n'a pas été contrôlée dans cette mission. MIG-0010 n'a pas été activée sur cette base. Aucun contenu clinique, posologique, réglementaire ou PEBC réel n'a été ajouté ; toutes les valeurs sont des fixtures synthétiques. Aucune dépendance ni donnée personnelle n'a été ajoutée.

## Problèmes, résolution et dette restante

Les deux défauts de fixture/narrowing ont reçu des corrections minimales. Le timeout d'intégration a été ajusté sur preuve reproductible liée au passage à dix migrations, sans modifier le mécanisme contrôlé. Le moteur reste volontairement limité à quatre unités et deux dimensions ; son extension devra être versionnée et justifiée. Aucun générateur de variantes ni corpus d'exercices réel n'est inclus.

## Éléments exclus et actions non effectuées

Exclus : `.tmp-migration-runner/`, `DOCS1/`, `backups/`, `dossier evolution/`, `mentor-platform-restaure/`, `docs/reports/RAPPORT-ETAT-DEVELOPPEMENT.md`, `data/`, contenu clinique réel et tout travail FND-04.

Aucun merge, push, rebase, activation MIG-0010, seed utilisateur ou modification de la base utilisateur.

## Verdict et prochaine étape

Verdict : **VALIDABLE**.

Prochaine étape recommandée : effectuer la revue finale ciblée et intégrer FND-03 vers `main`.

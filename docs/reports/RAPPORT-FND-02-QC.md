# RAPPORT FND-02-QC — QUEBEC PRACTICE EXTENSION

## Objectif et périmètre

Étendre le Canadian Practice Core existant à la province `QC`, sans créer de modèle parallèle, et ajouter la migration additive MIG-0009 de la version 8 à la version 9. Le lot couvre le domaine, les contrats applicatifs, la persistence SQLite, l'API existante, le registre et les validations de migrations, ainsi que les tests synthétiques.

Branche de travail : `feat/fnd-02-qc-quebec-practice`.

Le plan `docs/specs/V6-FND-02-QC-IMPLEMENTATION-PLAN.md`, commit `5556e2d`, a été contrôlé puis publié sur `origin/main` avant la création de la branche.

## Fichiers créés

- `src/infrastructure/database/sqlite/migrations/definitions/mig-0009-quebec-practice-extension.ts`
- `src/infrastructure/database/sqlite/migrations/mig-0009-quebec-practice-extension.test.ts`
- `docs/reports/RAPPORT-FND-02-QC.md`

## Fichiers modifiés

- `src/app/api/canadian-practice/route.test.ts`
- `src/app/api/canadian-practice/route.ts`
- `src/application/canadian-practice/canadian-practice-ports.ts`
- `src/application/canadian-practice/canadian-practice-queries.test.ts`
- `src/application/canadian-practice/canadian-practice-queries.ts`
- `src/domain/canadian-practice/canadian-practice.test.ts`
- `src/domain/canadian-practice/canadian-practice.ts`
- `src/infrastructure/canadian-practice/sqlite-canadian-practice-repository.integration.test.ts`
- `src/infrastructure/canadian-practice/sqlite-canadian-practice-repository.ts`
- `src/infrastructure/database/sqlite/activation/controlled-migration-activation.test.ts`
- `src/infrastructure/database/sqlite/backup/sqlite-backup-service.test.ts`
- `src/infrastructure/database/sqlite/migrations/database-readiness-orchestrator.test.ts`
- `src/infrastructure/database/sqlite/migrations/definitions/mig-0001-core-baseline.ts` — enregistrement minimal de MIG-0009 dans le registre global existant uniquement
- `src/infrastructure/database/sqlite/migrations/fresh-database-bootstrap.test.ts`
- `src/infrastructure/database/sqlite/migrations/fresh-database-bootstrap.ts`
- `src/infrastructure/database/sqlite/migrations/legacy-baseline-adopter.test.ts`
- `src/infrastructure/database/sqlite/migrations/mig-0002-document-import-journal.test.ts`
- `src/infrastructure/database/sqlite/migrations/mig-0003-source-model.test.ts`
- `src/infrastructure/database/sqlite/migrations/mig-0008-canadian-practice-core.test.ts`
- `src/infrastructure/database/sqlite/preflight/database-migration-preflight.test.ts`
- `src/infrastructure/database/sqlite/preflight/database-migration-preflight.ts`

Aucun fichier supprimé.

## Fonctionnalités réalisées et décisions techniques

- `CanadianProvince` accepte exclusivement `ON` et `QC`.
- `FEDERAL` exige toujours une province nulle ; `PROVINCIAL` exige `ON` ou `QC`.
- Le repository et la route `/api/canadian-practice` réutilisent les contrats et cas d'usage existants.
- Les lectures ON et QC sont isolées et conservent la résolution temporelle, `ruleVersion`, `sourceVersionId`, `verifiedAt`, les dates d'effet, le statut et l'avertissement d'indépendance.
- Les événements structurés existants et `trace_id` sont conservés ; aucune nouvelle télémétrie ni donnée personnelle.
- Aucun contenu réglementaire québécois réel, URL, traduction juridique ou seed n'a été ajouté. Les données de test sont synthétiques.

## Migration

MIG-0009 est une migration verticale v8 vers v9. SQLite ne permettant pas la modification directe d'une contrainte `CHECK`, la table `canadian_practice_rule_versions` est reconstruite transactionnellement : nouvelle table avec les mêmes colonnes, PK, deux FK, unicité et contraintes, copie intégrale, remplacement, puis recréation des deux index. La seule évolution fonctionnelle est `province IN ('ON','QC')` pour `PROVINCIAL`.

MIG-0008 et les définitions MIG-0002 à MIG-0008 sont inchangées. MIG-0001 ne reçoit que l'import et l'enregistrement minimal de MIG-0009 dans le registre global historique. La dette `TECH-DEBT-MIG-REGISTRY` reste ouverte : extraire ultérieurement ce registre dans un fichier dédié par refactor contrôlé.

Les tests MIG-0009 valident le bootstrap vierge jusqu'à v9, la migration synthétique v8 vers v9, la préservation des données legacy/Foundation/MCQ/ON, l'acceptation QC, la cohérence FEDERAL, les FK, les index, l'historique et `PRAGMA integrity_check = ok` sur les bases synthétiques.

## Base utilisateur

`data/mentor.db` n'a été ni ouverte, ni interrogée, ni modifiée, ni migrée pendant ce lot. Sa dernière version connue avant ce BUILD est 8, issue de la mission d'activation contrôlée précédente ; cette information n'a pas été revérifiée ici. MIG-0009 n'a été exécutée que sur des bases synthétiques ou en mémoire et n'a pas été activée sur la base utilisateur.

## Commandes et résultats

Toutes les commandes susceptibles d'initialiser SQLite ont défini `MENTOR_ENABLE_DEMO_DATA='0'` et un `MENTOR_DATA_DIRECTORY` absolu sous `C:\Users\otcho\AppData\Local\Temp`.

- Tests ciblés initiaux : `17` tests, `16` réussis, `1` échec. L'ancien cas négatif API utilisait `QC`, devenu valide ; il a été corrigé pour utiliser la province non supportée `BC`.
- Relance isolée API : `$env:MENTOR_DATA_DIRECTORY='C:\Users\otcho\AppData\Local\Temp\mentor-fnd02-qc-route-20260815'; $env:MENTOR_ENABLE_DEMO_DATA='0'; .\node_modules\.bin\vitest.cmd run src/app/api/canadian-practice/route.test.ts` — `1` fichier, `5/5` tests réussis.
- Chaîne migration/preflight/activation ciblée : `$env:MENTOR_DATA_DIRECTORY='C:\Users\otcho\AppData\Local\Temp\mentor-fnd02-qc-migrations-20260815'; $env:MENTOR_ENABLE_DEMO_DATA='0'; .\node_modules\.bin\vitest.cmd run src/infrastructure/database/sqlite/migrations/mig-0009-quebec-practice-extension.test.ts src/infrastructure/database/sqlite/migrations/fresh-database-bootstrap.test.ts src/infrastructure/database/sqlite/migrations/database-readiness-orchestrator.test.ts src/infrastructure/database/sqlite/preflight/database-migration-preflight.test.ts src/infrastructure/database/sqlite/activation/controlled-migration-activation.test.ts` — `5` fichiers, `56/56` tests réussis.
- Tests ciblés finaux : `$env:MENTOR_DATA_DIRECTORY='C:\Users\otcho\AppData\Local\Temp\mentor-fnd02-qc-targeted-final-20260815'; $env:MENTOR_ENABLE_DEMO_DATA='0'; .\node_modules\.bin\vitest.cmd run src/domain/canadian-practice/canadian-practice.test.ts src/application/canadian-practice/canadian-practice-queries.test.ts src/infrastructure/canadian-practice/sqlite-canadian-practice-repository.integration.test.ts src/app/api/canadian-practice/route.test.ts src/infrastructure/database/sqlite/migrations/mig-0008-canadian-practice-core.test.ts src/infrastructure/database/sqlite/migrations/mig-0009-quebec-practice-extension.test.ts` — `6` fichiers, `20/20` tests réussis.
- Typecheck initial : `$env:MENTOR_DATA_DIRECTORY='C:\Users\otcho\AppData\Local\Temp\mentor-fnd02-qc-quality-20260815'; $env:MENTOR_ENABLE_DEMO_DATA='0'; .\node_modules\.bin\tsc.cmd --noEmit` — échec ciblé : le contrat de `resolveActive` restait limité à `"ON" | null`.
- Typecheck après correction minimale : même commande — réussi, code de sortie `0`.
- Lint : `$env:MENTOR_DATA_DIRECTORY='C:\Users\otcho\AppData\Local\Temp\mentor-fnd02-qc-quality-20260815'; $env:MENTOR_ENABLE_DEMO_DATA='0'; .\node_modules\.bin\eslint.cmd .` — réussi, code de sortie `0`, aucun avertissement ESLint.
- Tests globaux : `$env:MENTOR_DATA_DIRECTORY='C:\Users\otcho\AppData\Local\Temp\mentor-fnd02-qc-quality-20260815'; $env:MENTOR_ENABLE_DEMO_DATA='0'; .\node_modules\.bin\vitest.cmd run` — `84/84` fichiers et `410/410` tests réussis.
- Build : `$env:MENTOR_DATA_DIRECTORY='C:\Users\otcho\AppData\Local\Temp\mentor-fnd02-qc-quality-20260815'; $env:MENTOR_ENABLE_DEMO_DATA='0'; .\node_modules\.bin\next.cmd build` — réussi, compilation et TypeScript réussis, `21/21` pages statiques générées.
- `git diff --check` — réussi ; seuls des avertissements Git de conversion future LF vers CRLF ont été émis, sans erreur d'espace.

## Problèmes et résolution

Deux incohérences locales ont été détectées et résolues : le test d'une province non supportée utilisait encore QC, et le type d'entrée du cas d'usage restait borné à ON. Les corrections minimales utilisent respectivement BC pour le rejet et `CanadianProvince | null` pour le contrat applicatif. Aucun autre correctif ou refactor n'a été entrepris.

## Éléments volontairement exclus

- `.tmp-migration-runner/`
- `DOCS1/`
- `backups/`
- `dossier evolution/`
- `mentor-platform-restaure/`
- `docs/reports/RAPPORT-ETAT-DEVELOPPEMENT.md`
- `data/`, notamment `data/mentor.db`
- tout contenu FND-03, seed réglementaire ou corpus juridique réel

## Actions non effectuées

Aucun merge, rebase, push de la branche feature, activation utilisateur de MIG-0009, ouverture de la base utilisateur, ajout de dépendance ou travail FND-03.

## Statut et verdict

Le périmètre fonctionnel et les quality gates sont conformes. Le rapport et les changements doivent être indexés explicitement puis réunis dans le commit local dédié `feat(canadian-practice): add quebec practice extension`. La branche feature ne doit pas être poussée dans cette mission.

Verdict : **VALIDABLE**.

Prochaine étape recommandée : effectuer la revue finale ciblée, intégrer FND-02-QC sur `main`, puis préparer séparément l'activation contrôlée de MIG-0009.

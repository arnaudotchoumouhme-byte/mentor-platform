# RAPPORT FINAL — LOT 5 MCQ CORE

Date de vérification : 2026-08-12
Branche Git : `main`
Verdict : **VALIDABLE**

## Mise à jour de validation du 2026-08-13

Cette mise à jour remplace les résultats de campagne antérieurs lorsqu'ils diffèrent. Le contrôle a été limité au Lot 5 et à ses dépendances directes. HEAD est resté `b58a09046f1aad4d581113056767be268ac8413c`, sur la branche `main`, alignée avec la référence locale `origin/main`. L'index Git est resté vide.

### Correction bloquante minimale

- Fichier : `eslint.config.mjs`.
- Cause : `eslint .` inspectait `.tmp-migration-runner/`, répertoire temporaire proté et hors Lot 5, et signalait 82 erreurs `@typescript-eslint/no-require-imports` dans ses fichiers JavaScript générés.
- Correction : ajout de `.tmp-migration-runner/**` à `globalIgnores`. Aucun fichier de ce répertoire n'a été ouvert, modifié, supprimé, indexé ou inclus au Lot 5.

### Contexte de données

Toutes les commandes susceptibles d'initialiser l'application ont utilisé :

```powershell
$env:MENTOR_DATA_DIRECTORY='C:\Users\otcho\AppData\Local\Temp\mentor-lot5-validation-20260813'
$env:MENTOR_ENABLE_DEMO_DATA='0'
```

La première exécution globale avait employé par erreur `MENTOR_ENABLE_DEMO_DATA='false'`; trois suites n'avaient alors pas été collectées, car la configuration accepte uniquement `0` ou `1`. Les trois suites concernées ont ensuite réussi avec la valeur `0`, puis la suite globale complète a réussi. `data/mentor.db` n'a été ni ouverte, ni interrogée, ni modifiée, ni migrée pendant cette campagne. Son état version 5 reste fondé sur le dernier contrôle documenté, et n'a pas été revérifié directement le 2026-08-13.

### Résultats observés le 2026-08-13

| Validation | Commande effectivement probante | Résultat exact |
| --- | --- | --- |
| Tests MCQ ciblés | `.\node_modules\.bin\vitest.cmd run src/domain/mcq src/application/mcq src/infrastructure/mcq src/app/api/mcq --maxWorkers=1` | 10 fichiers, 33/33 tests réussis |
| MIG-0006 isolée | `.\node_modules\.bin\vitest.cmd run src/infrastructure/database/sqlite/migrations/mig-0006-mcq-core.test.ts --maxWorkers=1 --reporter=verbose` | 1 fichier, 3/3 tests réussis; base v5 synthétique vers v6, base vierge vers v6, contraintes/index |
| Typecheck | `.\node_modules\.bin\tsc.cmd --noEmit` | réussi, code 0, aucune erreur |
| Lint initial | `.\node_modules\.bin\eslint.cmd .` | échec : 82 erreurs, toutes dans `.tmp-migration-runner/` |
| Lint après correction | `.\node_modules\.bin\eslint.cmd .` | réussi, code 0, aucun avertissement |
| Relance des 3 suites affectées par la variable invalide | `.\node_modules\.bin\vitest.cmd run src/infrastructure/documents/local-document-storage.test.ts src/app/api/health/route.test.ts src/app/api/actions/route.test.ts --maxWorkers=1` | 3 fichiers, 13/13 tests réussis |
| Tests globaux finaux | `.\node_modules\.bin\vitest.cmd run` | 68 fichiers, 347/347 tests réussis |
| Build | `.\node_modules\.bin\next.cmd build` | Next.js 16.3.0; compilation réussie; TypeScript réussi; 21/21 pages générées |
| `git diff --check` | `git diff --check` | réussi, code 0; avertissements Git de conversion LF vers CRLF uniquement |
| `verify` | tentative via `pnpm.cmd run verify` non achevée | non validé directement : le lanceur `pnpm.cmd` local a expiré; ses composants typecheck, lint, 347 tests et build ont tous été exécutés séparément avec succès |

Une tentative de `pnpm exec vitest ...` n'a lancé aucun test : le gestionnaire a signalé `ERR_PNPM_META_FETCH_FAIL` puis `vitest n'est pas reconnu`. Les binaires verrouillés déjà installés dans `node_modules/.bin/` ont donc servi aux validations probantes, sans installation ni ajout de dépendance.

### Revue technique ciblée

- Les items conservent un `itemId` stable et une version positive; choix, clé, explication, difficulté, provenance et mappings sont validés puis gelés.
- Les sessions `STUDY` et `QUIZ` enregistrent un snapshot ordonné des couples item/version, interdisent les réponses doubles, permettent la reprise et figent le score à la clôture.
- Le repository SQLite emploie des transactions pour la création, la réponse et la clôture; les clés étrangères et contraintes d'unicité de MIG-0006 limitent les écritures aux tables MCQ prévues.
- Les routes valident corps et paramètres, propagent un trace ID, utilisent des statuts déterministes et ne renvoient pas les messages internes.
- Les définitions MIG-0002 à MIG-0005 restent identiques à HEAD. Dans MIG-0001, seul l'import de `mcqCoreMigration` et son ajout au registre global colocé sont présents; la définition fonctionnelle et le checksum de MIG-0001 sont inchangés.
- MIG-0006 n'a été exécutée que sur des bases synthétiques.

### Verdict actualisé

Le Lot 5 est **validable avec réserve d'intégration** : les validations fonctionnelles passent et le diff est propre, mais `pnpm.cmd run verify` n'a pas fourni de résultat direct dans cet environnement. Aucun commit ne doit être créé sans validation humaine du périmètre, notamment de la correction `eslint.config.mjs`. MIG-0006 demeure non activée sur la base utilisateur.

## Objectif et périmètre

Le Lot 5 introduit le noyau MCQ : modèle de domaine, cas d'usage applicatifs, persistance SQLite, contrats HTTP, migration versionnée MIG-0006, tests et documentation d'exploitation. La validation couvre également l'intégration au mécanisme de migration existant et l'absence de mutation de la base utilisateur pendant les essais de MIG-0006.

Le périmètre exclut explicitement l'activation de MIG-0006 sur `data/mentor.db`, tout travail Lot 6 et toute publication Git distante.

## Fonctionnalités réalisées

- Modèle de domaine MCQ : items, sessions, sélection, score et correspondance au blueprint.
- Cas d'usage de création de session, soumission d'une réponse, lecture et clôture d'une session.
- Dépôt SQLite MCQ et tests d'intégration.
- Routes API pour les sessions, réponses et clôture MCQ.
- Migration MIG-0006 créant le schéma MCQ versionné.
- Adaptation du bootstrap, du preflight et des contrôles de readiness à la version cible 6.
- Documentation d'architecture, de traçabilité, du module et du runbook MCQ.

## Décisions techniques importantes

- MIG-0006 est ajoutée au registre global `coreMigrationRegistry` actuellement défini dans `src/infrastructure/database/sqlite/migrations/definitions/mig-0001-core-baseline.ts`.
- Conformément à la décision humaine prise pour le Lot 5, ce registre n'a pas été déplacé pendant ce lot.
- La définition fonctionnelle de `coreBaselineMigration` n'a pas été modifiée : le diff de MIG-0001 contient uniquement l'import de `mcqCoreMigration` et son ajout au registre global.
- Les définitions de MIG-0002, MIG-0003, MIG-0004 et MIG-0005 sont identiques à HEAD.
- Les builds et vérifications ont utilisé des répertoires de données temporaires absolus, distincts de `data/`, afin d'empêcher toute initialisation implicite de la base utilisateur.

## Migrations concernées

- MIG-0001 : aucune modification fonctionnelle; ajout strictement limité au référencement de MIG-0006 dans le registre global colocé.
- MIG-0002 à MIG-0005 : définitions historiques inchangées.
- MIG-0006 : seule nouvelle définition de migration; testée uniquement sur des bases SQLite synthétiques, notamment les scénarios v5 vers v6 et bootstrap propre vers v6.
- Aucune activation de MIG-0006 n'a été effectuée sur la base utilisateur.

## État de la base utilisateur

Contrôle final effectué en lecture seule sur `data/mentor.db` :

- `PRAGMA integrity_check` : `ok`.
- Version reconnue : `5`.
- Historique présent : MIG-0001, MIG-0002, MIG-0003, MIG-0004 et MIG-0005.
- MIG-0006 absente de l'historique, comme attendu.
- Aucune écriture ou migration de la base utilisateur pendant la validation du Lot 5.

## Inventaire exhaustif des fichiers

Inventaire vérifié en lecture seule avec `git status --short --branch`, `git diff --name-only`, `git ls-files --others --exclude-standard`, `git diff --stat` et `git diff --check`.

### Fichiers suivis modifiés

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/TRACEABILITY.md`
- `src/architecture/architecture-boundaries.test.ts`
- `src/infrastructure/database/sqlite/activation/controlled-migration-activation.test.ts`
- `src/infrastructure/database/sqlite/backup/sqlite-backup-service.test.ts`
- `src/infrastructure/database/sqlite/migrations/database-readiness-orchestrator.test.ts`
- `src/infrastructure/database/sqlite/migrations/definitions/mig-0001-core-baseline.ts`
- `src/infrastructure/database/sqlite/migrations/fresh-database-bootstrap.test.ts`
- `src/infrastructure/database/sqlite/migrations/fresh-database-bootstrap.ts`
- `src/infrastructure/database/sqlite/migrations/legacy-baseline-adopter.test.ts`
- `src/infrastructure/database/sqlite/migrations/mig-0002-document-import-journal.test.ts`
- `src/infrastructure/database/sqlite/migrations/mig-0003-source-model.test.ts`
- `src/infrastructure/database/sqlite/preflight/database-migration-preflight.test.ts`
- `src/infrastructure/database/sqlite/preflight/database-migration-preflight.ts`
- `src/presentation/api/http-error-mapper.test.ts`
- `src/presentation/api/http-error-mapper.ts`

### Fichiers créés et non suivis appartenant au Lot 5

- `docs/adr/ADR-0005-mcq-versioned-items.md`
- `docs/modules/mcq.md`
- `docs/runbooks/RUN-MCQ.md`
- `src/app/api/mcq/sessions/[sessionId]/answers/route.ts`
- `src/app/api/mcq/sessions/[sessionId]/complete/route.ts`
- `src/app/api/mcq/sessions/[sessionId]/route.ts`
- `src/app/api/mcq/sessions/mcq-route-contract.test.ts`
- `src/app/api/mcq/sessions/route.test.ts`
- `src/app/api/mcq/sessions/route.ts`
- `src/application/mcq/complete-mcq-session.test.ts`
- `src/application/mcq/complete-mcq-session.ts`
- `src/application/mcq/create-mcq-session.test.ts`
- `src/application/mcq/create-mcq-session.ts`
- `src/application/mcq/get-mcq-session.ts`
- `src/application/mcq/mcq-ports.ts`
- `src/application/mcq/mcq-use-case-test-harness.ts`
- `src/application/mcq/submit-mcq-answer.test.ts`
- `src/application/mcq/submit-mcq-answer.ts`
- `src/domain/mcq/blueprint-mapping.ts`
- `src/domain/mcq/mcq-errors.ts`
- `src/domain/mcq/mcq-session.test.ts`
- `src/domain/mcq/mcq-session.ts`
- `src/domain/mcq/question-item.test.ts`
- `src/domain/mcq/question-item.ts`
- `src/domain/mcq/question-selection.test.ts`
- `src/domain/mcq/question-selection.ts`
- `src/domain/mcq/scoring.test.ts`
- `src/domain/mcq/scoring.ts`
- `src/infrastructure/database/sqlite/migrations/definitions/mig-0006-mcq-core.ts`
- `src/infrastructure/database/sqlite/migrations/mig-0006-mcq-core.test.ts`
- `src/infrastructure/mcq/server-mcq.ts`
- `src/infrastructure/mcq/sqlite-mcq-repository.integration.test.ts`
- `src/infrastructure/mcq/sqlite-mcq-repository.ts`
- `src/test/fixtures/mcq-items.ts`

### Rapport du Lot 5

- `docs/reports/RAPPORT-LOT-5.md` — fichier local non suivi, non indexé, non commité et non poussé.

### Fichiers et dossiers explicitement exclus

Les éléments préexistants ci-dessous apparaissent dans la liste globale des fichiers non suivis, mais n'appartiennent pas au Lot 5 et sont strictement exclus de son périmètre :

- `.tmp-migration-runner/` et tous ses artefacts JavaScript temporaires.
- `backups/` et toutes les sauvegardes manuelles ou contrôlées qu'il contient.
- `DOCS1/` et tous ses documents.
- `dossier evolution/` et tous ses documents et sous-dossiers.
- `mentor-platform-restaure/` et tout son contenu.

Le rapprochement entre l'inventaire non suivi global et la liste Lot 5 ci-dessus ne laisse aucun fichier d'un dossier protégé dans le périmètre du Lot 5. `data/mentor.db` est également hors périmètre Git. Aucun fichier n'a été supprimé.

## Tests et commandes exécutés

Campagne finale exécutée le 2026-08-12 :

L'historique PowerShell persistant n'est pas disponible dans l'environnement d'exécution (`Get-History` ne retourne aucune entrée). La liste ci-dessous repose uniquement sur les commandes effectivement lancées et leurs sorties observées pendant la campagne; aucun succès non vérifié n'est déclaré.

- `pnpm.cmd run typecheck` : réussi, `tsc --noEmit` sans erreur.
- `pnpm.cmd run lint` : réussi, `eslint .` sans erreur.
- Tests migrations ciblés, avec un worker : **15 fichiers réussis, 136/136 tests réussis**.
- `controlled-migration-activation.test.ts` isolé : **1 fichier réussi, 16/16 tests réussis**.
- Tests MCQ ciblés : **10 fichiers réussis, 33/33 tests réussis**.
- Test MIG-0006 isolé : **1 fichier réussi, 3/3 tests réussis**.
- `pnpm.cmd run test` : **68 fichiers réussis, 347/347 tests réussis**.
- `pnpm.cmd run build` : réussi avec Next.js 16.3.0; compilation, TypeScript et génération de 21 pages réussies.
- `pnpm.cmd run verify` : réussi; typecheck, lint, **347/347 tests** et build réussis.
- `git diff --check` : réussi, code de sortie 0.
- Lecture SQLite finale : intégrité `ok`, version maximale `5`.

Les avertissements `ExperimentalWarning: SQLite is an experimental feature` émis par Node.js n'ont pas provoqué d'échec.

### Commandes littérales exécutées

Les blocs suivants reproduisent les commandes PowerShell effectivement exécutées et récupérables dans la trace de validation. Les commandes ont été lancées depuis la racine du dépôt.

#### Typecheck, lint et tests complets

Ces trois contrôles ont été exécutés dans une même commande séquentielle :

```powershell
$env:Path = 'C:\Users\otcho\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;' + $env:Path; $pnpm = 'C:\Users\otcho\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd'; & $pnpm run typecheck; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; & $pnpm run lint; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; & $pnpm run test
```

- `MENTOR_DATA_DIRECTORY` : non définie par cette commande.
- `MENTOR_ENABLE_DEMO_DATA` : non définie par cette commande.
- Autre variable d'environnement définie : `Path`, préfixée par `C:\Users\otcho\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;`.
- Variable PowerShell locale : `$pnpm = 'C:\Users\otcho\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd'`.
- Sous-commandes produit exécutées : `pnpm.cmd run typecheck`, `pnpm.cmd run lint`, puis `pnpm.cmd run test` via ce chemin absolu.

#### Tests migrations ciblés — première passe groupée

```powershell
& '.\node_modules\.bin\vitest.cmd' run src/infrastructure/database/sqlite/activation/controlled-migration-activation.test.ts src/infrastructure/database/sqlite/migrations src/infrastructure/database/sqlite/preflight/database-migration-preflight.test.ts; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; & '.\node_modules\.bin\vitest.cmd' run src/domain/mcq src/application/mcq src/infrastructure/mcq src/app/api/mcq
```

- `MENTOR_DATA_DIRECTORY` : non définie par cette commande.
- `MENTOR_ENABLE_DEMO_DATA` : non définie par cette commande.
- Autres variables d'environnement définies : aucune.
- Résultat de la partie migration : 15 fichiers exécutés, 134/136 tests réussis; deux timeouts à cinq secondes dans `ControlledMigrationActivation`. La partie MCQ placée après `if ($LASTEXITCODE -ne 0)` n'a pas été exécutée dans cette commande en raison du code de sortie non nul.

Une tentative antérieure avec une liste explicite de fichiers a expiré au niveau du processus après environ 121 secondes sans sortie de résultats exploitable. Sa commande exacte est récupérable :

```powershell
$pnpm = (Get-Command pnpm.cmd -ErrorAction SilentlyContinue).Source; if (-not $pnpm) { $pnpm = 'C:\Users\otcho\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd' }; & $pnpm exec vitest run src/infrastructure/database/sqlite/activation/controlled-migration-activation.test.ts src/infrastructure/database/sqlite/migrations/database-readiness-orchestrator.test.ts src/infrastructure/database/sqlite/migrations/fresh-database-bootstrap.test.ts src/infrastructure/database/sqlite/migrations/fresh-database-detector.test.ts src/infrastructure/database/sqlite/migrations/legacy-baseline-adopter.test.ts src/infrastructure/database/sqlite/migrations/legacy-schema-recognizer.test.ts src/infrastructure/database/sqlite/migrations/mig-0002-document-import-journal.test.ts src/infrastructure/database/sqlite/migrations/mig-0003-source-model.test.ts src/infrastructure/database/sqlite/migrations/mig-0005-clinical-coach.test.ts src/infrastructure/database/sqlite/migrations/mig-0006-mcq-core.test.ts src/infrastructure/database/sqlite/migrations/migration-foundation.test.ts src/infrastructure/database/sqlite/migrations/migration-history-validation.test.ts src/infrastructure/database/sqlite/migrations/sqlite-migration-history-store.test.ts src/infrastructure/database/sqlite/migrations/sqlite-schema-inspector.test.ts src/infrastructure/database/sqlite/preflight/database-migration-preflight.test.ts; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; & $pnpm exec vitest run src/domain/mcq src/application/mcq src/infrastructure/mcq src/app/api/mcq
```

- `MENTOR_DATA_DIRECTORY` : non définie par cette commande.
- `MENTOR_ENABLE_DEMO_DATA` : non définie par cette commande.
- Autres variables d'environnement définies : aucune.

#### Relance des tests migrations avec un seul worker

```powershell
& '.\node_modules\.bin\vitest.cmd' run src/infrastructure/database/sqlite/activation/controlled-migration-activation.test.ts src/infrastructure/database/sqlite/migrations src/infrastructure/database/sqlite/preflight/database-migration-preflight.test.ts --maxWorkers=1
```

- `MENTOR_DATA_DIRECTORY` : non définie par cette commande.
- `MENTOR_ENABLE_DEMO_DATA` : non définie par cette commande.
- Autres variables d'environnement définies : aucune.
- Résultat : 15 fichiers réussis, 136/136 tests réussis.

#### Test isolé ControlledMigrationActivation puis tests MCQ ciblés

```powershell
& '.\node_modules\.bin\vitest.cmd' run src/infrastructure/database/sqlite/activation/controlled-migration-activation.test.ts --reporter=verbose; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; & '.\node_modules\.bin\vitest.cmd' run src/domain/mcq src/application/mcq src/infrastructure/mcq src/app/api/mcq
```

- `MENTOR_DATA_DIRECTORY` : non définie par cette commande.
- `MENTOR_ENABLE_DEMO_DATA` : non définie par cette commande.
- Autres variables d'environnement définies : aucune.
- Résultats : `ControlledMigrationActivation`, 16/16 tests; tests MCQ ciblés, 10 fichiers et 33/33 tests.

#### Test MIG-0006 isolé

```powershell
& '.\node_modules\.bin\vitest.cmd' run src/infrastructure/database/sqlite/migrations/mig-0006-mcq-core.test.ts --reporter=verbose
```

- `MENTOR_DATA_DIRECTORY` : non définie par cette commande.
- `MENTOR_ENABLE_DEMO_DATA` : non définie par cette commande.
- Autres variables d'environnement définies : aucune.
- Résultat : 1 fichier réussi, 3/3 tests réussis, sur bases synthétiques uniquement.

#### Build

```powershell
$env:Path = 'C:\Users\otcho\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;' + $env:Path; $pnpm = 'C:\Users\otcho\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd'; $gateData = Join-Path $env:LOCALAPPDATA 'Temp\mentor-lot5-build-data'; New-Item -ItemType Directory -Force -Path $gateData | Out-Null; $env:MENTOR_DATA_DIRECTORY = $gateData; & $pnpm run build
```

- `MENTOR_DATA_DIRECTORY` : `C:\Users\otcho\AppData\Local\Temp\mentor-lot5-build-data`.
- `MENTOR_ENABLE_DEMO_DATA` : non définie par cette commande.
- Autre variable d'environnement définie : `Path`, préfixée par `C:\Users\otcho\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;`.
- Variables PowerShell locales : `$pnpm` avec le chemin absolu ci-dessus et `$gateData` résolu vers le chemin temporaire absolu indiqué.
- Commande produit exécutée dans ce contexte : `pnpm.cmd run build` via `$pnpm`.

#### Verify

```powershell
$env:Path = 'C:\Users\otcho\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;' + $env:Path; $pnpm = 'C:\Users\otcho\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd'; $gateData = Join-Path $env:LOCALAPPDATA 'Temp\mentor-lot5-verify-data'; New-Item -ItemType Directory -Force -Path $gateData | Out-Null; $env:MENTOR_DATA_DIRECTORY = $gateData; & $pnpm run verify
```

- `MENTOR_DATA_DIRECTORY` : `C:\Users\otcho\AppData\Local\Temp\mentor-lot5-verify-data`.
- `MENTOR_ENABLE_DEMO_DATA` : non définie par cette commande.
- Autre variable d'environnement définie : `Path`, préfixée par `C:\Users\otcho\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;`.
- Variables PowerShell locales : `$pnpm` avec le chemin absolu ci-dessus et `$gateData` résolu vers le chemin temporaire absolu indiqué.
- Commande produit exécutée dans ce contexte : `pnpm.cmd run verify` via `$pnpm`.

#### Contrôle `git diff --check`

La sous-commande littérale exécutée dans le bloc d'inspection final était :

```powershell
git diff --check
```

Elle était immédiatement suivie de l'affichage de `$LASTEXITCODE`; résultat observé : code 0. `MENTOR_DATA_DIRECTORY`, `MENTOR_ENABLE_DEMO_DATA` et les autres variables d'environnement n'ont pas été définies par cette sous-commande.

#### Contrôle SQLite final en lecture seule

```powershell
node -e "const {DatabaseSync}=require('node:sqlite'); const db=new DatabaseSync('data/mentor.db',{readOnly:true}); console.log(JSON.stringify({integrityCheck:db.prepare('PRAGMA integrity_check').get(),currentVersion:db.prepare('SELECT MAX(to_version) AS version FROM schema_migrations').get(),migrations:db.prepare('SELECT migration_id,from_version,to_version FROM schema_migrations ORDER BY to_version').all()})); db.close();"
```

- `MENTOR_DATA_DIRECTORY` : non définie par cette commande.
- `MENTOR_ENABLE_DEMO_DATA` : non définie par cette commande.
- Autres variables d'environnement définies : aucune.
- Ouverture de `data/mentor.db` avec `{readOnly:true}`.
- Résultat exact : `integrity_check = ok`, version maximale `5`, historique MIG-0001 à MIG-0005.

## Problèmes rencontrés et résolution

Une première exécution groupée et parallèle des tests de migration a atteint le timeout Vitest de cinq secondes sur deux scénarios de `ControlledMigrationActivation`, avec 134 tests réussis sur 136. Aucun échec fonctionnel ou défaut de données n'était rapporté.

La suite `ControlledMigrationActivation` a ensuite été relancée isolément : 16/16 tests réussis. L'ensemble ciblé migration a également été relancé avec un seul worker : 136/136 tests réussis. Le problème est donc identifié comme une contention liée à l'exécution parallèle, et non comme une régression fonctionnelle.

## Dette technique restante

`TECH-DEBT-MIG-REGISTRY` — `coreMigrationRegistry` est colocé avec la définition de MIG-0001 dans `mig-0001-core-baseline.ts`. Le Lot 5 conserve cette convention établie et y ajoute uniquement MIG-0006 au registre global. Le registre devra être extrait dans un fichier dédié lors d'un refactor contrôlé futur, sans modifier les définitions ni checksums des migrations historiques.

Cette dette est également documentée dans `docs/adr/ADR-0005-mcq-versioned-items.md`.

## Statut Git final au moment du rapport

- Branche : `main`, alignée sur la référence affichée `origin/main` au moment du contrôle (`## main...origin/main`; aucun écart ahead/behind annoncé par `git status --short --branch`).
- Arbre de travail : modifié, avec fichiers suivis modifiés et nouveaux fichiers non suivis.
- Index Git : vide; aucun fichier n'est indexé.
- Rapport : local et non suivi; non indexé, non commité et non poussé.
- Aucun commit du Lot 5 n'a été créé.

Résumé du diff suivi avant création de ce rapport : **17 fichiers modifiés, 64 insertions et 29 suppressions**. Les nouveaux fichiers non suivis ne sont pas inclus dans ce résumé Git.

## Fichiers et dossiers volontairement exclus

Les éléments préexistants suivants restent non suivis, non indexés et doivent rester hors de tout futur commit du Lot 5 :

- `.tmp-migration-runner/`
- `backups/`
- `DOCS1/`
- `dossier evolution/`
- `mentor-platform-restaure/`

`data/mentor.db` n'est pas incluse dans les changements Git du Lot 5.

## Actions non effectuées

- Aucune activation de MIG-0006.
- Aucune migration de `data/mentor.db` vers la version 6.
- Aucun travail Lot 6.
- Aucun ajout à l'index Git.
- Aucun commit.
- Aucune fusion.
- Aucun push GitHub.
- Aucune pull request.

## Verdict final

**VALIDABLE.** Le Lot 5 satisfait les contrôles techniques exécutés. Les 347 tests passent, les tests ciblés migrations et MCQ passent, le build et `verify` passent, les migrations historiques restent fonctionnellement immuables, et la base utilisateur reste intègre en version 5. La dette de registre est explicite et acceptée pour ce lot.

## Prochaines étapes recommandées

1. Faire relire et valider humainement ce rapport et le périmètre du Lot 5.
2. Après autorisation explicite seulement, préparer un index Git limité aux fichiers du Lot 5 et au présent rapport, en excluant strictement les cinq répertoires protégés.
3. Contrôler le diff indexé avant toute autorisation de commit.
4. Ne préparer ou activer MIG-0006 sur la base utilisateur que dans une opération contrôlée distincte, avec preflight, sauvegarde vérifiée et autorisation humaine dédiée.
5. Planifier séparément le refactor `TECH-DEBT-MIG-REGISTRY`.
6. Ne commencer le Lot 6 qu'après validation humaine explicite.

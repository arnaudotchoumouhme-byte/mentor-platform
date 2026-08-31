# DEV-001 — ARBRE LOCAL SÉCURISÉ

Date : 2026-08-28

Branche : `main`

HEAD : `7bcd6d9b2d64f2a78b83583c6331f09c23868be0`

Relation : `main...origin/main`
Objet : inventorier, classifier et proposer le découpage de l'arbre local sans perdre ni modifier les travaux existants.

# Résumé

L'arbre local contient **1 835 fichiers ou entrées fichier classifiés** au démarrage de DEV-001 :

- 47 fichiers suivis signalés modifiés par `git status` ;
- 1 788 fichiers non suivis retournés par `git ls-files --others --exclude-standard` ;
- aucun fichier indexé ;
- 45 fichiers suivis ont un diff de contenu réel ;
- 2 fichiers suivis sont signalés modifiés mais n'ont aucun diff de contenu (`src/app/pilot/page.tsx` et `mig-0001-core-baseline.ts`) ;
- 28 fichiers sont des artefacts compilés sous `.tmp-migration-runner/` ;
- 1 715 fichiers non suivis appartiennent aux ensembles protégés/personnels ;
- 45 nouveaux fichiers fonctionnels ou documentaires sont potentiellement intégrables.

Le diff de contenu suivi représente 45 fichiers, 693 insertions et 156 suppressions. `git diff --check` réussit ; Git émet uniquement des avertissements de conversion future LF vers CRLF.

Aucune correction n'a été appliquée. Cette décision évite de supprimer des artefacts ou de restaurer des fichiers sans autorisation dédiée. Le seul nouveau fichier de DEV-001 est le présent rapport.

# État Git initial

Commandes exécutées en lecture seule :

- `git status --short --branch` ;
- `git diff --stat` ;
- `git diff --name-status` ;
- `git diff --check` ;
- `git ls-files --others --exclude-standard` ;
- `git log -12 --oneline --decorate` ;
- inspection ciblée des rapports, fichiers pnpm, build/runtime, UI, migrations et scripts.

Résultats :

- branche `main`, HEAD et `origin/main` sur `7bcd6d9` ;
- index vide ;
- 47 entrées suivies ` M` ;
- 1 788 fichiers non suivis ;
- aucun ajout, suppression ou renommage suivi ;
- aucun conflit Git ;
- `git diff --check` : PASS.

Le dernier commit publié contient le durcissement provisioning/persistence/diagnostic. Les travaux actuels lui sont postérieurs et mélangent quatre sujets fonctionnels et leur documentation.

# Classification complète des fichiers

Chaque fichier appartient à une seule catégorie. Les grands répertoires protégés sont décrits comme ensembles exhaustifs : tous les fichiers qu'ils contiennent héritent de la catégorie indiquée.

## A. BUILD_RUNTIME — 7 fichiers

Ces fichiers séparent le build Next du runtime SQLite et imposent le disque Render au démarrage réel.

- `scripts/check-persistent-storage.mjs` — stockage Render obligatoire au runtime même sans flag ;
- `scripts/check-persistent-storage.test.mjs` — tests mount dédié/overlay ;
- `src/infrastructure/config/app-config.ts` — distinction `phase-production-build` / runtime ;
- `src/infrastructure/config/app-config.test.ts` — Auth0 reste obligatoire au build, mount seulement au runtime ;
- `src/instrumentation.ts` — initialisation DB uniquement au runtime Node ;
- `src/lib/db.ts` — ouverture SQLite strictement paresseuse ;
- `src/infrastructure/config/render-build-boundary.test.ts` — preuve d'absence d'effet DB au build/import de route.

Cohérence : périmètre fonctionnel autonome, déjà couvert par tests ciblés et par le build Render simulé de l'audit précédent.

## B. UI — 10 fichiers

Ces fichiers composent la refonte Mentor PEBC et ses projections de dashboard.

- `src/app/ai/page.tsx` — adaptation mineure de navigation/présentation ;
- `src/app/clinical-cases/page.tsx` — hub ECOS neutre ;
- `src/app/globals.css` — styles de la nouvelle expérience ;
- `src/app/page.tsx` — nouvelle page d'accueil ;
- `src/app/pilot/page.tsx` — signalé modifié sans diff de contenu ;
- `src/app/quizzes/page.tsx` — branchement visuel au runner MCQ moderne ;
- `src/components/app-shell.tsx` — navigation réorganisée ;
- `src/presentation/dashboard/pebc-dashboard.ts` — projection dashboard ;
- `src/presentation/dashboard/pebc-dashboard.test.ts` — tests de projection ;
- `src/presentation/dashboard/pebc-interface.test.ts` — tests de l'interface/états.

Chevauchement : `src/app/quizzes/page.tsx` dépend fonctionnellement du runner MCQ de la catégorie C. Il doit être commité avec MCQ ou après celui-ci, même s'il est classé UI.

## C. MCQ_MIG0014 — 37 fichiers

### Fichiers suivis modifiés — 10

- `docs/modules/mcq.md` — documentation du contrat/import MCQ ;
- `docs/runbooks/RUN-MCQ.md` — procédure opérateur ;
- `src/app/api/mcq/sessions/mcq-route-contract.test.ts` — contrat public avant/après réponse ;
- `src/app/api/mcq/sessions/route.test.ts` — tests de catalogue/session ;
- `src/app/api/mcq/sessions/route.ts` — projection des blueprints jouables ;
- `src/application/mcq/mcq-ports.ts` — port nécessaire au contenu jouable ;
- `src/application/mcq/mcq-use-case-test-harness.ts` — harness adapté ;
- `src/infrastructure/mcq/server-mcq.ts` — câblage runtime MCQ moderne ;
- `src/infrastructure/mcq/sqlite-mcq-repository.integration.test.ts` — tests repository/version publiée ;
- `src/infrastructure/mcq/sqlite-mcq-repository.ts` — sélection des versions jouables.

### Nouveaux fichiers — 27

- `scripts/import-mcq-corpus.ts` — commande d'import explicite ;
- `src/application/mcq/import-mcq-corpus.ts` ;
- `src/application/mcq/import-mcq-corpus.test.ts` ;
- `src/application/mcq/list-mcq-blueprints.ts` ;
- `src/application/mcq/mcq-corpus-contract.ts` ;
- `src/application/mcq/mcq-corpus-contract.test.ts` ;
- `src/application/mcq/playable-mcq-session.ts` ;
- `src/application/mcq/playable-mcq-session.test.ts` ;
- `src/application/mcq/submit-playable-mcq-answer.ts` ;
- `src/components/mcq-session-runner.tsx` ;
- `src/components/mcq-session-runner.test.tsx` ;
- `src/infrastructure/database/sqlite/migrations/definitions/mig-0014-mcq-content-import.ts` ;
- `src/infrastructure/database/sqlite/migrations/mig-0014-mcq-content-import.test.ts` ;
- `src/infrastructure/mcq/sqlite-mcq-corpus-writer.ts` ;
- `src/infrastructure/mcq/sqlite-mcq-corpus-writer.integration.test.ts` ;
- `docs/schemas/mcq-corpus-v1.schema.json` ;
- `docs/specs/PEBC-ITEM-AUTHORING-STANDARD-V1.md` ;
- `docs/reports/RAPPORT-MCQ-CONTENT-IMPORT.md` ;
- `docs/content/SNC-QCM-PILOT-V2.md` ;
- `docs/content/SNC-QCM-PILOT-V3.md` ;
- `docs/content/SNC-QCM-PILOT-V4.md` ;
- `docs/content/SNC-QCM-V3-CLINICAL-VALIDATION.md` ;
- `docs/content/SNC-QCM-PILOT-V4-EDITORIAL-SAFETY-REVIEW.md` ;
- `docs/content/SNC-QCM-PILOT-V4-IMPORT-MAPPING.md` ;
- `docs/content/SNC-QCM-PILOT-V4-PUBLISHED-MAPPING.md` ;
- `docs/content/SNC-QCM-PILOT-V4.mcq-corpus.json` ;
- `docs/content/SNC-QCM-PILOT-V4-PUBLISHED.mcq-corpus.json`.

Cohérence : contrat, import transactionnel, migration additive, projection jouable et corpus forment un ensemble logique. Le corpus clinique mérite néanmoins une revue documentaire séparée du code.

## D. SOURCE_ALIAS_MIG0015 — 33 fichiers

### Fichiers suivis modifiés — 21

Ces modifications propagent le registre courant v15 et rendent les gardes compatibles avec le registre extrait :

- `src/infrastructure/database/sqlite/activation/controlled-migration-activation.ts` ;
- `src/infrastructure/database/sqlite/activation/controlled-migration-activation.test.ts` ;
- `src/infrastructure/database/sqlite/backup/sqlite-backup-service.test.ts` ;
- `src/infrastructure/database/sqlite/migrations/database-readiness-orchestrator.ts` ;
- `src/infrastructure/database/sqlite/migrations/database-readiness-orchestrator.test.ts` ;
- `src/infrastructure/database/sqlite/migrations/definitions/mig-0001-core-baseline.ts` — signalé modifié, aucun diff de contenu ;
- `src/infrastructure/database/sqlite/migrations/fresh-database-bootstrap.ts` ;
- `src/infrastructure/database/sqlite/migrations/fresh-database-bootstrap.test.ts` ;
- `src/infrastructure/database/sqlite/migrations/legacy-baseline-adopter.ts` ;
- `src/infrastructure/database/sqlite/migrations/legacy-baseline-adopter.test.ts` ;
- `src/infrastructure/database/sqlite/migrations/mig-0003-source-model.test.ts` ;
- `src/infrastructure/database/sqlite/migrations/mig-0010-calculations-lab-core.test.ts` ;
- `src/infrastructure/database/sqlite/migrations/mig-0011-osce-text-core.test.ts` ;
- `src/infrastructure/database/sqlite/migrations/mig-0012-closed-web-pilot.test.ts` ;
- `src/infrastructure/database/sqlite/migrations/mig-0013-pilot-provisioning-audit.test.ts` ;
- `src/infrastructure/database/sqlite/preflight/database-migration-preflight.ts` ;
- `src/infrastructure/database/sqlite/preflight/database-migration-preflight.test.ts` ;
- `src/infrastructure/database/sqlite/sqlite-mentor-actions.ts` ;
- `src/infrastructure/database/sqlite/sqlite-mentor-actions.test.ts` ;
- `src/infrastructure/diagnostics/server-readiness.ts` ;
- `src/infrastructure/pilot/sqlite-pilot-repository.ts`.

### Nouveaux fichiers — 12

- `scripts/source-version-editorial-alias.ts` ;
- `src/domain/documents/editorial-source-alias.ts` ;
- `src/domain/documents/editorial-source-alias.test.ts` ;
- `src/application/documents/source-version-editorial-alias-port.ts` ;
- `src/application/documents/source-version-editorial-alias.ts` ;
- `src/application/documents/source-version-editorial-alias.test.ts` ;
- `src/infrastructure/documents/sqlite-source-version-editorial-alias-repository.ts` ;
- `src/infrastructure/documents/sqlite-source-version-editorial-alias-repository.integration.test.ts` ;
- `src/infrastructure/documents/source-version-editorial-alias-build-boundary.test.ts` ;
- `src/infrastructure/database/sqlite/migrations/core-migration-registry.ts` ;
- `src/infrastructure/database/sqlite/migrations/definitions/mig-0015-source-version-editorial-alias.ts` ;
- `src/infrastructure/database/sqlite/migrations/mig-0015-source-version-editorial-alias.test.ts`.

Chevauchement critique : `core-migration-registry.ts` importe à la fois MIG-0014 et MIG-0015. Pour obtenir deux commits fonctionnels, il faudra créer lors de l'indexation une révision intermédiaire du registre contenant MIG-0014 seulement, puis ajouter MIG-0015 dans le commit suivant. Cette modification de séquençage n'est pas réalisée dans DEV-001.

## E. TEMP_CODEX — 28 fichiers

Tous les fichiers sous `.tmp-migration-runner/` sont des JavaScript compilés et un `package.json` de runner éphémère :

- 1 `package.json` ;
- 1 `sqlite-executor.js` ;
- 3 fichiers sous `activation/` et `backup/` ;
- 22 fichiers sous `migrations/` ;
- 1 fichier sous `preflight/`.

Ils reproduisent des sources suivies TypeScript pour exécuter d'anciennes préparations de migration. Ils ne sont pas destinés au dépôt. Aucun fichier `.codex-*.test.ts` n'est actuellement présent. Ces 28 fichiers sont des candidats de suppression, mais ont été conservés faute d'autorisation explicite de suppression après inventaire.

## F. DOCS_REPORTS — 2 fichiers

- `docs/reports/AUDIT-FINALISATION-MENTOR-PLATEFORME.md` — audit final créé avant DEV-001 ;
- `docs/reports/RAPPORT-ETAT-DEVELOPPEMENT.md` — rapport historique daté d'un ancien HEAD.

Le présent `docs/reports/DEV-001-ARBRE-LOCAL-SECURISE.md` est la seule création autorisée de cette mission et n'est pas compté dans l'état initial de 1 835 fichiers.

## G. HORS_PERIMETRE / INDETERMINE — 1 718 fichiers

### Configuration partagée à découper par lignes — 3 fichiers

- `package.json` — ajoute les deux commandes `mcq:import` et `source-version-alias`, ainsi que `tsx` ;
- `pnpm-lock.yaml` — verrouille `tsx@4.20.6` et `esbuild@0.25.12` ;
- `pnpm-workspace.yaml` — autorise uniquement le build d'`esbuild`.

Ces fichiers sont utiles, mais couvrent MCQ et alias. Ils ne peuvent pas être attribués honnêtement à un seul des deux sujets. Un commit préalable TOOLING est recommandé.

### Ensembles protégés/personnels — 1 715 fichiers

- `.tmp-migration-runner/` exclu ici car classé E ;
- `DOCS1/` : 7 fichiers ;
- `backups/` : 62 fichiers ;
- `content-sources/` : 1 638 fichiers ;
- `dossier evolution/` : 7 fichiers ;
- `mentor-platform-restaure/` : 1 entrée Git non suivie représentant un dépôt/dossier restauré.

Tous les fichiers de ces cinq ensembles sont classés G, sans exception. Ils ne doivent entrer dans aucun futur commit. `data/` n'apparaît pas dans la liste non suivie et n'a pas été inspecté.

# Fichiers temporaires / accidentels

1. `.tmp-migration-runner/` — 28 artefacts générés, temporaires démontrés, non destinés au dépôt.
2. `src/app/pilot/page.tsx` — Git le signale modifié mais `git diff`, `git diff --numstat` et `git diff -w` sont vides. Probable différence de stat/fin de ligne, pas un changement fonctionnel.
3. `src/infrastructure/database/sqlite/migrations/definitions/mig-0001-core-baseline.ts` — même anomalie : statut modifié, diff vide. La définition historique n'est pas fonctionnellement modifiée.
4. avertissements LF→CRLF sur les 45 fichiers avec diff — ils annoncent une conversion future, mais le diff courant n'est pas constitué uniquement de fins de ligne.
5. aucun fichier `.codex-*.test.ts`, aucun script de prepare/execute Codex autonome et aucune duplication exacte manifeste dans les fichiers fonctionnels candidats.

# Corrections triviales effectuées

**Aucune (0).**

Justification :

- supprimer `.tmp-migration-runner/` reste destructif, même si son caractère temporaire est démontré ;
- restaurer les deux fichiers au statut fantôme pourrait changer leur encodage/fin de ligne sans bénéfice fonctionnel ;
- normaliser massivement LF/CRLF augmenterait artificiellement le diff ;
- les autres changements sont fonctionnels ou documentaires et sortent des corrections triviales autorisées.

# Fichiers laissés inchangés

Tous les 1 835 fichiers initiaux ont été laissés inchangés. Les bases, backups, corpus source, rapports historiques, migrations, scripts, configuration pnpm et code métier n'ont subi aucune mutation.

# Plan de découpage en futurs commits

## COMMIT A — BUILD/RUNTIME

Fichiers : les 7 fichiers de la catégorie A.

Raison : corriger le défaut Render `Collecting page data` tout en conservant un démarrage runtime fail-closed.

Dépendances : aucune dépendance sur MIG-0014/15. Doit être intégré en premier.

Tests : `app-config.test.ts`, `render-build-boundary.test.ts`, `check-persistent-storage.test.mjs`, typecheck, lint, build Render simulé, `git diff --check`.

## COMMIT B — TOOLING D'EXPLOITATION

Fichiers : `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`.

Raison : fournir `tsx` aux deux commandes explicites et autoriser uniquement `esbuild@0.25.12`.

Dépendances : avant C et D. Attention : l'environnement Windows a encore montré `uv_os_get_passwd/ENOMEM`; ce commit doit rester bloqué tant que DEV-002 n'a pas validé le lanceur.

Tests : installation frozen-lockfile, politique ignored builds, démarrage `tsx`, help des deux commandes sans DB, typecheck, `git diff --check`.

## COMMIT C — MCQ CONTENT IMPORT + MIG-0014

Fichiers : les 37 fichiers de la catégorie C, plus `src/app/quizzes/page.tsx` de B. Le registre intermédiaire doit contenir MIG-0014 mais pas MIG-0015.

Raison : livrer un moteur unique pour `/quizzes`, le contrat, l'importeur et la migration v13→v14.

Dépendances : A et B ; registre intermédiaire contrôlé ; aucune activation réelle dans le commit.

Tests : contrat corpus, import rollback/idempotence/FK, migration 13→14 synthétique, repository/session ownership, fuite de clé, route API, runner UI, typecheck, lint, tests globaux, build, diff-check.

## COMMIT D — SOURCE ALIAS + MIG-0015

Fichiers : les 33 fichiers de la catégorie D, moins les deux fichiers au statut fantôme s'ils disparaissent après refresh ; ajout final de MIG-0015 dans `core-migration-registry.ts`.

Raison : alias éditorial 1:1 immuable et résolution vers UUID réel.

Dépendances : C/MIG-0014 intégré en premier ; B pour la commande.

Tests : validation alias, associate/resolve/idempotence/collisions, rollback, triggers UPDATE/DELETE, FK RESTRICT, source supprimée, migration 14→15 synthétique, build boundary, typecheck, lint, suite migration, diff-check.

## COMMIT E — UI MENTOR PEBC

Fichiers : les fichiers B restants après retrait de `src/app/quizzes/page.tsx`, soit accueil, shell, styles, hubs, dashboard et tests.

Raison : refonte visuelle indépendante des schémas.

Dépendances : C avant E si les liens/runner QCM sont conservés. Aucun besoin de D.

Tests : dashboard/interface ciblés, pages concernées, typecheck, lint, build, contrôle desktop/tablette/mobile, diff-check.

## COMMIT F — DOCUMENTATION ET CORPUS

Fichiers : rapports A/F pertinents, standard PEBC, documents V2→V4, mapping et corpus JSON. `RAPPORT-ETAT-DEVELOPPEMENT.md` ne doit être intégré qu'après mise à jour factuelle ; les sources binaires restent exclues.

Raison : rendre l'état, la provenance et la politique éditoriale auditables sans mélanger le code.

Dépendances : après les commits fonctionnels correspondants afin que les rapports citent des SHA réels.

Tests : validation JSON/schema, contrôle des 10 clés, recherche de secrets/PII, liens/chemins, `git diff --check`.

# Ordre recommandé

1. obtenir une autorisation séparée pour supprimer `.tmp-migration-runner/` ou l'ajouter à une règle d'exclusion ;
2. COMMIT A — BUILD/RUNTIME ;
3. DEV-002 puis COMMIT B — TOOLING ;
4. préparer le registre intermédiaire et COMMIT C — MCQ/MIG-0014 ;
5. COMMIT D — ALIAS/MIG-0015 ;
6. COMMIT E — UI ;
7. COMMIT F — docs/corpus avec SHA et résultats réels.

Alternative plus sûre si le registre intermédiaire ne doit pas être édité : fusionner C et D en un seul commit « content infrastructure MIG-0014/15 ». Cette alternative réduit la finesse de rollback mais évite un état de registre artificiel.

# Tests recommandés par commit

| Commit | Minimum ciblé | Gates finaux |
|---|---|---|
| A | config, storage, instrumentation/build boundary | typecheck, lint, build Render, diff-check |
| B | `tsx`, ignored builds, deux `--help` sans écriture | frozen install, typecheck, diff-check |
| C | MCQ contract/import/repo/API/UI + migration 14 | suite globale, build, diff-check |
| D | alias domain/use cases/repo + migration 15 | migrations/preflight/activation, suite globale, build, diff-check |
| E | dashboard/pages/navigation responsive | typecheck, lint, tests UI, build, diff-check |
| F | schema JSON, clés, références, secret scan | diff-check documentaire |

# Risques

- le registre courant lie MIG-0014 et MIG-0015 et empêche un simple `git add` par fichiers pour deux commits autonomes ;
- les modifications génériques de migration sont nombreuses et doivent être comparées au registre cible de chaque commit ;
- `package.json` ajoute deux commandes dans le même hunk ; une indexation partielle mal contrôlée peut produire un lockfile incohérent ;
- le lanceur `tsx` reste un blocage opérationnel même si sa dépendance `esbuild` est autorisée de façon ciblée ;
- les fichiers au statut fantôme peuvent réapparaître selon la normalisation Git Windows ;
- le corpus et les documents locaux ne doivent pas entraîner l'ajout des 1 638 sources binaires ;
- les rapports historiques peuvent annoncer des états non alignés avec le futur découpage ;
- aucun nettoyage automatique ne doit utiliser `git add .`, `git add -A` ou une suppression récursive large.

# État Git final

Après création de ce rapport uniquement :

- branche : `main` ;
- HEAD : `7bcd6d9` ;
- index : vide ;
- changements initiaux : conservés ;
- nouveau fichier DEV-001 : `docs/reports/DEV-001-ARBRE-LOCAL-SECURISE.md` ;
- corrections triviales : 0 ;
- base réelle ouverte/modifiée : NON ;
- migration/import/ingestion : NON ;
- commit/push/merge/rebase/Render : NON ;
- `git diff --check` final : PASS (exit 0 ; avertissements LF→CRLF non bloquants).

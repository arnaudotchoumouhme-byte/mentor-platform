# RAPPORT — MCQ CONTENT IMPORT

## Objectif et périmètre

Implémenter la première tranche de l'Option B : un corpus QCM JSON versionné, importable explicitement et joué par le MCQ Core existant depuis `/quizzes`. Aucun contenu clinique réel, seed, import réel ou mutation de la base utilisateur n'est inclus.

## Git

- Branche : `main`
- État : modifications locales non indexées, non commitées et non poussées.
- Le dépôt contenait avant cette intervention d'autres modifications locales BUILD/RUNTIME/UI et des répertoires protégés ; ils ont été préservés.

## Fichiers du périmètre

### Créés

- `docs/schemas/mcq-corpus-v1.schema.json`
- `scripts/import-mcq-corpus.ts`
- `src/application/mcq/import-mcq-corpus.ts`
- `src/application/mcq/import-mcq-corpus.test.ts`
- `src/application/mcq/list-mcq-blueprints.ts`
- `src/application/mcq/mcq-corpus-contract.ts`
- `src/application/mcq/mcq-corpus-contract.test.ts`
- `src/application/mcq/playable-mcq-session.ts`
- `src/application/mcq/playable-mcq-session.test.ts`
- `src/application/mcq/submit-playable-mcq-answer.ts`
- `src/components/mcq-session-runner.tsx`
- `src/components/mcq-session-runner.test.tsx`
- `src/infrastructure/database/sqlite/migrations/core-migration-registry.ts`
- `src/infrastructure/database/sqlite/migrations/definitions/mig-0014-mcq-content-import.ts`
- `src/infrastructure/database/sqlite/migrations/mig-0014-mcq-content-import.test.ts`
- `src/infrastructure/mcq/sqlite-mcq-corpus-writer.ts`
- `src/infrastructure/mcq/sqlite-mcq-corpus-writer.integration.test.ts`
- `docs/reports/RAPPORT-MCQ-CONTENT-IMPORT.md`

### Modifiés pour cette tranche

- `package.json`
- `pnpm-lock.yaml`
- `docs/modules/mcq.md`
- `docs/runbooks/RUN-MCQ.md`
- `src/app/api/mcq/sessions/route.ts`
- `src/app/api/mcq/sessions/route.test.ts`
- `src/app/quizzes/page.tsx`
- `src/application/mcq/mcq-ports.ts`
- `src/application/mcq/mcq-use-case-test-harness.ts`
- `src/infrastructure/mcq/server-mcq.ts`
- `src/infrastructure/mcq/sqlite-mcq-repository.ts`
- `src/infrastructure/mcq/sqlite-mcq-repository.integration.test.ts`
- les consommateurs et tests du registre de migrations, mis à jour pour la version cible 14 sans modification fonctionnelle des définitions MIG-0001 à MIG-0013 ;
- `src/infrastructure/pilot/sqlite-pilot-repository.ts`, dont la garde de schéma accepte désormais toute version supérieure ou égale à 13.

Aucun fichier n'a été supprimé.

## Fonctionnalités réalisées

- Contrat strict `MCQ_CORPUS/1` et schéma JSON documenté.
- Validation stricte Zod et validation métier existante des items.
- `ImportMcqCorpus` avec port d'écriture distinct du port de session.
- Import SQLite transactionnel, idempotent par checksum et refus de réécriture ou de trou de version.
- Sélection limitée à la dernière version `PUBLISHED` de chaque item.
- Catalogue de blueprints jouables via `GET /api/mcq/sessions`.
- Projection avant réponse sans clé ni explication ; correction et explication après soumission seulement.
- `/quizzes` utilise le runner MCQ Core et présente des états chargement, erreur, vide et session.
- Commande explicite `mcq:import`, sans ouverture SQLite en mode validation et sans migration implicite.

## Décisions techniques

- Le MCQ Core reste le moteur unique de `/quizzes` ; les données legacy ne sont ni converties ni importées.
- Les versions d'items restent immuables et les snapshots de session préservent l'historique.
- Le registre global est exposé par un nouveau fichier dédié qui compose le registre historique avec MIG-0014 ; les fichiers MIG-0001 à MIG-0013 restent inchangés.
- L'import exige des chemins absolus, `--apply` et une base déjà en version 14.

## Migration

- Nouvelle migration : MIG-0014, additive, version 13 vers 14.
- Nouvelle table : `mcq_item_editorial_metadata`.
- Métadonnées : statut éditorial, `source_version_id`, référence structurée, corpus/version, checksum et date d'import.
- Clés étrangères restrictives vers `mcq_question_versions` et `source_versions` ; index statut et source.
- MIG-0014 testée uniquement sur bases SQLite synthétiques.
- MIG-0001 à MIG-0013 : aucune définition modifiée.
- MIG-0014 non activée sur `data/mentor.db`.

## État de la base utilisateur

`data/mentor.db` n'a été ni ouverte, ni interrogée, ni modifiée, ni migrée. Aucun corpus n'a été importé.

## Contrôles exécutés

- Tests ciblés MCQ/MIG-0014 : 11 fichiers, 29/29 tests réussis.
- Test ciblé readiness après correction du registre de test : 14/14 réussis.
- Tests ciblés activation/preflight/backup/startup : 4 fichiers, 41/41 réussis.
- TypeScript complet : réussi, aucune sortie d'erreur.
- ESLint complet : réussi, aucune sortie d'erreur.
- Suite globale : 117 fichiers, 534/534 tests réussis.
- Build Next.js production avec `RENDER=true`, `NEXT_PHASE=phase-production-build`, `MENTOR_ENABLE_DEMO_DATA=0` et `MENTOR_DATA_DIRECTORY` temporaire : réussi, 22/22 pages.
- `git diff --check` sur le périmètre MCQ/MIG-0014 : réussi.
- `git diff --check` global : échec uniquement sur `src/app/pilot/page.tsx:3: new blank line at EOF`, modification locale préexistante hors périmètre.

## Problèmes rencontrés et résolution

- L'arbre `node_modules` était incomplet et interrompait Vitest avec des modules absents. Seul ce dossier généré a été supprimé puis reconstruit depuis `pnpm-lock.yaml`, avec scripts d'installation désactivés.
- Un test readiness utilisait encore directement le registre historique v13 ; son import a été remplacé par le registre courant v14.
- Aucune réparation ni mutation de base réelle n'a été effectuée.

## Dette et risques restants

- Aucun corpus réel n'est fourni : `/quizzes` affiche normalement l'état vide jusqu'à un import autorisé.
- Le workflow éditorial de cette tranche est fichier/CLI : publier ou retirer exige une nouvelle version, aucune interface d'administration n'est fournie.
- La `source_version_id` doit préexister ; le pipeline de revue documentaire reste une étape opérateur.
- Les écrans legacy autres que `/quizzes`, notamment certains examens blancs, restent hors de cette tranche.
- Le contrôle global `git diff --check` reste bloqué par une ligne vide hors périmètre dans `src/app/pilot/page.tsx`.

## Éléments volontairement exclus

- `.tmp-migration-runner/`
- `backups/`
- `DOCS1/`
- `dossier evolution/`
- `mentor-platform-restaure/`
- `docs/reports/RAPPORT-ETAT-DEVELOPPEMENT.md`
- `data/`, notamment `data/mentor.db`
- contenu clinique réel, données patient, demo data, génération depuis documents et conversion legacy.

## Actions non effectuées

Aucun import réel, seed, migration utilisateur, activation MIG-0014, démarrage avec base réelle, indexation Git, commit, push, déploiement ou travail sur un lot suivant.

## Verdict

Validable avec réserve : le code, les tests et le build sont verts ; le seul échec global de `git diff --check` appartient à une modification locale préexistante hors périmètre.

## Revue finale avant MIG-0014

- Projection client : avant réponse, la sérialisation ne contient ni `correctChoiceId` ni explication ; après soumission, la correction est exposée uniquement pour l'item répondu.
- Ownership : GET, answer et complete résolvent l'identité serveur puis appellent `assertMcqSession` avant le cas d'usage. Un test commun démontre qu'un refus retourne 403 et qu'aucun cas d'usage n'est exécuté. L'adaptateur SQLite refuse un `learnerId` différent.
- Publication : les nouvelles sessions sélectionnent uniquement la version `PUBLISHED` la plus récente ; une version DRAFT plus récente ne remplace pas la dernière version publiée.
- Immuabilité : une version existante est comparée au contenu persistant et à ses mappings, en plus du checksum. Même une collision de checksum simulée est refusée.
- Atomicité : un corpus dont un item ultérieur référence une source absente annule aussi les items valides précédemment traités dans la transaction.
- Source : garde applicative et FK SQLite restrictive vers `source_versions`; les deux comportements sont testés.
- MIG-0014 : passage synthétique v13 vers v14 réussi, historique legacy préservé et `integrity_check=ok`.
- Garde provisioning `>=13` : elle est compatible avec v14 parce que MIG-0014 est additive et ne modifie aucune table pilote. Les versions inconnues en avance restent bloquées par le preflight/readiness avant initialisation des repositories ; la garde locale vérifie seulement la capacité minimale requise par le provisioning.
- `/quizzes` importe exclusivement `McqSessionRunner` et appelle `/api/mcq/sessions`; aucun appel au runner legacy ou à `/api/state` n'y subsiste.
- Build/démarrage : l'importeur n'est référencé que par la commande `mcq:import` et ses tests. Le build Render simulé ne crée ni n'ouvre SQLite. Une base utilisateur v13 existante est bloquée par le preflight de démarrage et n'est jamais migrée implicitement. Le bootstrap d'une base entièrement absente reste le mécanisme historique de création d'une nouvelle base, sans corpus ni demo data lorsque `MENTOR_ENABLE_DEMO_DATA=0`.

Contrôles finaux après durcissement : tests ciblés MCQ 40/40, TypeScript réussi, ESLint réussi, suite globale fonctionnellement validée et build 22/22.

Le diagnostic temporaire `AUTH0_SUB_MATCH`, le BOM, les chaînes mal encodées et les lignes vides de `src/app/pilot/page.tsx` ont été retirés. Le fichier correspond de nouveau exactement au comportement fonctionnel de `origin/main`, en UTF-8 sans BOM.

Le bootstrap d'une base entièrement absente a été conservé après revue. En développement avec `MENTOR_DATA_DIRECTORY` absolu, lors d'une première installation locale et dans les tests synthétiques, il initialise uniquement l'emplacement explicitement sélectionné ou le répertoire local conventionnel du dépôt. En production Render, la commande documentée `pnpm run start` exécute le contrôle physique du Persistent Disk avant `next start`; un mount absent, overlay, tmpfs, ramfs, hors chemin ou non inscriptible arrête le processus avant SQLite. Le build ignore explicitement l'initialisation runtime. Une base existante obsolète est inspectée en lecture seule et bloquée avant toute migration implicite.

Lors de la dernière campagne globale sous forte charge Windows, 537/539 tests ont réussi et deux scénarios du même fichier d'activation ont dépassé leur timeout de 10 s ; le fichier complet a immédiatement réussi isolément, 16/16. La campagne globale précédente sur le même état fonctionnel MCQ avait réussi 539/539. Aucun échec d'assertion n'a été observé.

## Prochaines étapes recommandées

1. Revoir humainement le diff de cette tranche et isoler les modifications locales préexistantes avant indexation.
2. Préparer séparément l'activation contrôlée de MIG-0014 sur la base cible avec sauvegarde et autorisation humaine.
3. Valider un premier corpus réel sourcé, puis exécuter d'abord la commande sans `--apply`.
4. Demander une autorisation distincte avant tout import réel avec `--apply`.

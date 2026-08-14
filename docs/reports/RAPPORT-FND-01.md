# RAPPORT CUMULATIF — FND-01 FOUNDATION ACADEMY CORE

Date de début : 2026-08-13
Branche : `feat/fnd-01-foundation-core`
Contrat directeur : `docs/specs/V6-FND-01-FOUNDATION-CONTRACTS.md`

## Périmètre général

Ce rapport couvre cumulativement FND-01A à FND-01F. Les six sous-lots sont implémentés et validés localement; aucun travail FND-02 n'a commencé.

## FND-01A — Domain contracts

### Objectif

Implémenter les contrats de domaine Foundation Academy, leurs invariants et leurs transitions, sans persistance, migration, API, UI, seed ou contenu clinique.

### Fichiers créés

- `src/domain/foundation/foundation-errors.ts`
- `src/domain/foundation/foundation-values.ts`
- `src/domain/foundation/curriculum.ts`
- `src/domain/foundation/diagnostic.ts`
- `src/domain/foundation/mastery.ts`
- `src/domain/foundation/unit-progress.ts`
- `src/domain/foundation/index.ts`
- `src/domain/foundation/curriculum.test.ts`
- `src/domain/foundation/diagnostic.test.ts`
- `src/domain/foundation/mastery.test.ts`
- `src/domain/foundation/unit-progress.test.ts`
- `docs/reports/RAPPORT-FND-01.md`

Aucun fichier existant n'a été modifié ou supprimé par FND-01A.

### Contrats implémentés

- `CurriculumVersion`, publication explicite et statut.
- `CurriculumBlock`, `CurriculumUnit`, `LearningObjective`, `PrerequisiteRule`.
- `FoundationDiagnostic` et `DiagnosticObservation` append-only.
- `MasteryEstimate` N0 à N4 avec confiance, preuves et `ruleVersion`.
- `FoundationRecommendation` REQUIRED, RECOMMENDED ou EXEMPTED avec justification et supersession possible.
- `ExitAssessment` avec décision seulement à la clôture.
- `FoundationUnitProgress` avec huit étapes et reprise idempotente.
- Valeurs métier : statuts, niveaux, catégories d'erreur critique et décisions pédagogiques.
- IDs au format UUID stable; `learnerId` reste une référence opaque.

### Invariants couverts

- Version positive, fenêtre d'effet valide, cohérence publication/horodatage et publication unique depuis un brouillon.
- Codes/titres/énoncés obligatoires, positions non négatives et durée d'unité positive.
- Prérequis ciblant exactement une autre unité ou un objectif.
- Diagnostic à portée non vide, progression monotone, clôture cohérente et refus d'observations après clôture.
- Confiance bornée, durée non négative et paire de référence externe cohérente.
- Preuve obligatoire pour N1 à N4, facultative pour N0; règle de calcul obligatoire.
- Recommandation justifiée et historique conservable.
- Erreur critique non résolue forçant `RETEST_REQUIRED`.
- Transitions unitaires contrôlées, horodatages monotones et reprise idempotente; progression distincte de la maîtrise.
- Objets et collections métier gelés pour éviter la mutation accidentelle.

### Ports

Aucun port applicatif créé. Les contrats FND-01A sont des fabriques pures recevant leurs IDs et timestamps. Clock, ID generator, repositories et rule provider ne deviennent nécessaires qu'avec les cas d'usage futurs; les créer ici aurait produit des abstractions inutilisées.

### Tests et gates

- Première passe Foundation : 4 fichiers, 15 tests; 11 réussis et 4 échecs dus à un matcher Vitest inexistant (`toBeFrozen`).
- Deuxième passe Foundation : 4 fichiers, 15 tests; 14 réussis et 1 échec de classification d'erreur.
- Test isolé maîtrise après correction : 1 fichier, 4/4 tests réussis.
- Suite Foundation finale avant revue : 4 fichiers, 15/15 tests réussis.
- Après revue technique et renforcement des invariants `RETIRED`/référence externe : 2 fichiers ciblés, 8/8 tests réussis.
- `pnpm.cmd run typecheck` : tentative expirée après 120 secondes sans sortie; le lanceur local présente le problème déjà documenté.
- Équivalent verrouillé `.\node_modules\.bin\tsc.cmd --noEmit` : réussi, code 0; relancé après la dernière correction, réussi.
- Équivalent verrouillé `.\node_modules\.bin\eslint.cmd .` : réussi, code 0, aucun avertissement.
- Contrôle final ciblé `.\node_modules\.bin\eslint.cmd src/domain/foundation` : réussi.
- Suite globale, exécutée une seule fois : 72 fichiers, 362/362 tests réussis.
- Build : non exécuté; aucun changement Next.js, API, UI ou configuration de build.
- `git diff --check` : réussi, code 0.

### Revue d'indépendance

- Aucun import SQLite, Next.js, React, OpenAI, infrastructure, MCQ ou Coach dans `src/domain/foundation`.
- Aucun repository, adapter, table ou accès fichier/base.
- Aucun changement fonctionnel dans MCQ, Coach ou RAG.
- Curriculum, Blueprint et Learner Model restent séparés; aucune déduction legacy.

### Migrations

Aucune migration créée, modifiée ou exécutée. MIG-0001 à MIG-0006 sont inchangées. MIG-0007 n'a pas commencé.

### État de la base utilisateur

`data/mentor.db` n'a été ni ouverte, ni interrogée, ni modifiée, ni migrée.

### Dette / évolution future

- Introduire les ports application (Clock, ID generator, repositories et policy provider) seulement avec les cas d'usage qui les consommeront.
- Valider humainement la configuration des seuils N0–N4 avant FND-01D; aucun seuil numérique n'est défini ici.
- L'unicité entre collections et la cohérence complète bloc/unité/objectif devront aussi être garanties par les agrégats applicatifs et la future persistance.

### Commit et état Git

- Commit documentaire préalable : `6bd3a22 docs(foundation): define fnd-01 contracts`.
- Commit FND-01A : `dcaf563 feat(foundation): implement fnd-01a domain contracts`.
- Aucun push, merge ou rebase effectué.
- Les éléments protégés préexistants restent non suivis et hors commit.

### Verdict FND-01A

**VALIDÉ** — commit FND-01A créé et contrôlé sur la branche dédiée.

## FND-01B — Persistence + MIG-0007

### Objectif

Ajouter uniquement la persistance SQLite des contrats Foundation existants et la migration additive MIG-0007 de la version 6 vers la version 7, sans contenu clinique, seed, cas d'usage complet, API ou UI.

### Fichiers créés

- `src/application/foundation/foundation-ports.ts`
- `src/infrastructure/foundation/foundation-persistence-error.ts`
- `src/infrastructure/foundation/sqlite-foundation-repository.ts`
- `src/infrastructure/foundation/sqlite-foundation-repository.integration.test.ts`
- `src/infrastructure/database/sqlite/migrations/definitions/mig-0007-foundation-academy-core.ts`
- `src/infrastructure/database/sqlite/migrations/mig-0007-foundation-academy-core.test.ts`

### Fichiers modifiés

- `src/infrastructure/database/sqlite/migrations/definitions/mig-0001-core-baseline.ts` : import et enregistrement de MIG-0007 uniquement; la définition et le checksum de MIG-0001 restent inchangés.
- `src/infrastructure/database/sqlite/migrations/fresh-database-bootstrap.ts`
- `src/infrastructure/database/sqlite/preflight/database-migration-preflight.ts`
- `src/infrastructure/database/sqlite/activation/controlled-migration-activation.test.ts`
- `src/infrastructure/database/sqlite/backup/sqlite-backup-service.test.ts`
- `src/infrastructure/database/sqlite/migrations/database-readiness-orchestrator.test.ts`
- `src/infrastructure/database/sqlite/migrations/fresh-database-bootstrap.test.ts`
- `src/infrastructure/database/sqlite/migrations/legacy-baseline-adopter.test.ts`
- `src/infrastructure/database/sqlite/migrations/mig-0002-document-import-journal.test.ts`
- `src/infrastructure/database/sqlite/migrations/mig-0003-source-model.test.ts`
- `src/infrastructure/database/sqlite/migrations/mig-0006-mcq-core.test.ts`
- `src/infrastructure/database/sqlite/preflight/database-migration-preflight.test.ts`
- `docs/reports/RAPPORT-FND-01.md`

Aucun fichier n'a été supprimé.

### Schéma et migration

- MIG-0007 est additive, de la version 6 à la version 7.
- Onze tables sont ajoutées : `curriculum_versions`, `curriculum_blocks`, `curriculum_units`, `learning_objectives`, `prerequisite_rules`, `foundation_diagnostics`, `diagnostic_observations`, `mastery_estimates`, `foundation_recommendations`, `exit_assessments` et `foundation_unit_progress`.
- UUID et dates sont stockés en `TEXT`; les enums sont protégés par `CHECK`; les relations historiques utilisent `ON DELETE RESTRICT`.
- Les versions de curriculum et les positions/codes hiérarchiques sont uniques. Des index uniques partiels empêchent les prérequis logiquement dupliqués malgré la sémantique SQLite des valeurs `NULL`, et une seule progression active est permise par apprenant/version/unité.
- Le bootstrap et le preflight valident le schéma Foundation à partir de la version 7.
- MIG-0001 à MIG-0006 ne comportent aucune modification fonctionnelle; seul le registre global actuellement colocé dans le fichier MIG-0001 reçoit MIG-0007.

### Repositories et ports

- `FoundationCurriculumRepository` persiste et relit atomiquement une version avec blocs, unités, objectifs et prérequis.
- `FoundationLearningRepository` couvre diagnostics et observations, estimations de maîtrise append-only, recommandations append-only, évaluations de sortie et progression d'unité.
- Le mapping domaine/lignes SQLite est explicite, les écritures composées sont transactionnelles et les erreurs sont encapsulées dans `FoundationPersistenceError`.
- Aucun ORM, package npm, Clock ou générateur d'ID spéculatif n'a été ajouté.

### Tests et contrôles

- Tests ciblés MIG-0007 + repository : 2 fichiers, 6/6 réussis.
- Chaîne ciblée migrations, preflight et activation contrôlée : 16 fichiers, 139/139 réussis.
- ` .\node_modules\.bin\tsc.cmd --noEmit` : réussi, code 0, aucune sortie.
- ` .\node_modules\.bin\eslint.cmd src/domain/foundation src/application/foundation src/infrastructure/foundation src/infrastructure/database/sqlite` : réussi, code 0, aucune sortie.
- Première suite globale : 73 fichiers réussis sur 74 et 367/368 tests; unique échec causé par `sqlite-backup-service.test.ts`, qui déclarait encore la version 6 pour une base fraîche désormais en version 7.
- Test isolé de sauvegarde après adaptation factuelle 6 → 7 : 1 fichier, 10/10 réussis.
- Suite globale finale : 74 fichiers, 368/368 tests réussis.
- `git diff --check` : réussi avant mise à jour du rapport; un contrôle final est exécuté avant commit.
- Build non exécuté : aucun élément Next.js, API, UI ou configuration de build n'est modifié.

Tous les tests SQLite ont utilisé des bases en mémoire ou des répertoires temporaires créés par les tests. Aucune commande applicative susceptible d'initialiser la base utilisateur n'a été lancée.

### Préservation et risques

- Le scénario synthétique v6 → v7 conserve les données legacy et MCQ et l'historique MIG-0001 à MIG-0006.
- Le bootstrap d'une base vierge atteint la version 7 avec les onze tables et sept entrées d'historique.
- L'activation contrôlée reconnaît le nouveau plan, mais MIG-0007 n'a pas été préparée ni activée sur la base utilisateur.
- Risque restant : l'activation réelle nécessitera ultérieurement preflight, sauvegarde vérifiée, autorisation humaine et post-validation.

### Architecture et dette

- Aucun import SQLite, Next.js ou React n'est introduit dans `src/domain/foundation`; l'infrastructure dépend des ports et du domaine, jamais l'inverse.
- Aucun couplage vers les implémentations MCQ, Coach ou RAG n'est ajouté.
- `TECH-DEBT-MIG-REGISTRY` reste ouverte : le registre global est colocé avec MIG-0001 et devra être extrait lors d'un refactor contrôlé futur.
- Les règles de calcul, seuils N0–N4, cas d'usage et contenu clinique restent volontairement hors FND-01B.

### État de la base utilisateur et exclusions

`data/mentor.db` n'a été ni ouverte, ni interrogée, ni modifiée, ni migrée. MIG-0007 n'a été testée que sur des bases synthétiques ou temporaires.

Restent explicitement hors périmètre et hors commit : `.tmp-migration-runner/`, `DOCS1/`, `backups/`, `dossier evolution/`, `mentor-platform-restaure/`, `docs/reports/RAPPORT-ETAT-DEVELOPPEMENT.md` et `data/`.

Aucun push, merge ou rebase n'a été effectué. Commit FND-01B : `21494d9 feat(foundation): implement fnd-01b persistence`.

### Verdict FND-01B

**VALIDÉ** — commit FND-01B créé et contrôlé sur la branche dédiée.

## FND-01C — Curriculum seed / configuration minimale

### Objectif et décision humaine

Implémenter uniquement une configuration initiale Foundation reproductible. La décision humaine **Option A** est appliquée : seed technique minimal non publié, sans prétention de contenu clinique validé ni de règle PEBC officielle.

### Fichiers

Créés :

- `src/application/foundation/foundation-curriculum-seed.ts`
- `src/infrastructure/foundation/foundation-curriculum-seed.integration.test.ts`

Modifié :

- `docs/reports/RAPPORT-FND-01.md`

Aucun fichier n'a été supprimé et aucune migration n'a été modifiée.

### Structure du seed

- Une `CurriculumVersion` technique stable : version 1, statut `DRAFT`, `publishedAt` nul.
- Identifiants UUID stables pour le programme, la version, les blocs, unités et objectifs.
- Date d'effet `2027-01-01T00:00:00.000Z`, explicitement technique et sans signification réglementaire PEBC.
- Exactement six blocs requis, dans l'ordre stable : `BIO`, `PHA`, `CALC`, `THER`, `CAN`, `COMM`.
- Une unité `DRAFT` de démonstration technique par bloc et un objectif `TECHNICAL_SEED` par unité.
- Descriptions explicitement non cliniques et non publiées; aucun prérequis, contenu thérapeutique détaillé ou seuil N0–N4.

Le seed utilise exclusivement `FoundationCurriculumRepository`. Il recherche d'abord l'identifiant stable : si la version existe, il la retourne sans écriture; si elle est absente, il persiste le snapshot complet. Il ne réécrit donc ni un brouillon existant ni une version publiée.

### Tests et contrôles

- Test ciblé du seed : 1 fichier, 3/3 tests réussis.
- Scénarios couverts : brouillon non publié avec six blocs, ordre/codes/IDs stables, seconde exécution sans doublon, lecture complète par repository et préservation d'une version publiée synthétique.
- `.\node_modules\.bin\tsc.cmd --noEmit` : réussi, code 0, aucune sortie.
- `.\node_modules\.bin\eslint.cmd src/domain/foundation src/application/foundation src/infrastructure/foundation` : réussi, code 0, aucune sortie.
- Suite globale exécutée une fois : 75 fichiers, 371/371 tests réussis.
- Build non exécuté : aucun changement Next.js ou de configuration de build.
- `git diff --check` : contrôle final exécuté avant indexation.

Tous les tests SQLite utilisent une base en mémoire. Le seed n'a été exécuté que dans ces scénarios synthétiques.

### Migrations, base utilisateur et exclusions

MIG-0001 à MIG-0007 sont inchangées. Le seed est entièrement séparé de MIG-0007; MIG-0007 n'a pas été activée sur la base utilisateur.

`data/mentor.db` n'a été ni ouverte, ni interrogée, ni modifiée, ni migrée. Restent hors périmètre et hors commit : `.tmp-migration-runner/`, `DOCS1/`, `backups/`, `dossier evolution/`, `mentor-platform-restaure/`, `docs/reports/RAPPORT-ETAT-DEVELOPPEMENT.md` et `data/`.

### Dette et risques

- Le seed ne constitue pas un curriculum clinique publiable; une validation pédagogique humaine reste obligatoire avant toute publication.
- Les unités/objectifs sont uniquement des démonstrateurs techniques et devront être remplacés par un contenu validé dans un lot contrôlé futur.
- `TECH-DEBT-MIG-REGISTRY` reste inchangée et hors périmètre.
- Aucun travail FND-01D, API, UI, moteur de diagnostic ou recommandation calculée n'a commencé.

### État Git et verdict FND-01C

Commit FND-01C : `195cc9c feat(foundation): implement fnd-01c curriculum seed`. Aucun push, merge ou rebase n'est effectué.

**VALIDÉ** — commit FND-01C créé et contrôlé sur la branche dédiée.

## FND-01D — Diagnostic

### Objectif

Implémenter les cinq cas d'usage applicatifs Foundation : démarrer et compléter un diagnostic, enregistrer des observations, estimer la maîtrise et produire une recommandation traçable. Aucun travail de progression d'unité, Exit Assessment, API ou UI n'est inclus.

### Fichiers

Créés :

- `src/application/foundation/foundation-diagnostic-use-cases.ts`
- `src/application/foundation/foundation-diagnostic-use-cases.integration.test.ts`

Modifiés :

- `src/application/foundation/foundation-ports.ts`
- `docs/reports/RAPPORT-FND-01.md`

Aucun fichier n'a été supprimé. MIG-0001 à MIG-0007, le seed FND-01C et les modules MCQ, Coach et RAG sont inchangés.

### Cas d'usage et ports

- `StartDiagnostic` vérifie l'existence et l'état de la CurriculumVersion, la portée non vide et l'appartenance des blocs, puis persiste un diagnostic `IN_PROGRESS`.
- `RecordObservation` charge le diagnostic et le curriculum, valide la hiérarchie bloc/unité/objectif, construit l'observation et persiste atomiquement le diagnostic et ses nouvelles preuves via le repository SQLite existant.
- `CompleteDiagnostic` clôt une campagne observée, persiste son état et traite une seconde clôture comme une opération idempotente.
- `EstimateMastery` sélectionne les observations de la portée, délègue N0–N4 et la confiance à une policy injectée, conserve les IDs de preuve et ajoute l'estimation à l'historique.
- `RecommendFoundationPath` délègue la proposition à la policy, conserve justification, preuve, `ruleVersion`, timestamp et `supersedesId`, puis ajoute la recommandation à l'historique.
- Ports ajoutés et consommés : `FoundationClock`, `FoundationIdGenerator` et `FoundationDiagnosticPolicy` avec `ruleVersion` explicite.

### Policy, maîtrise et recommandations

La décision humaine est respectée par une policy synthétique configurable dans les tests. Aucun seuil numérique produit ou PEBC n'est codé dans les agrégats ou les cas d'usage.

- N0 est accepté sans preuve; N1 à N4 exigent et conservent leurs preuves.
- Les estimations sont insert-only et plusieurs niveaux successifs restent dans l'historique.
- `REQUIRED`, `RECOMMENDED` et `EXEMPTED` sont testés avec justification et preuve.
- Toute recommandation sans observation est refusée explicitement.
- Une erreur critique présente dans la portée est considérée non résolue dans FND-01D et force `REQUIRED` si la policy propose une progression positive; aucun workflow de résolution n'est inventé.
- Les décisions sont des recommandations pédagogiques internes et ne constituent ni certification, ni admissibilité, ni prédiction PEBC.

### Tests et contrôles

- Première passe ciblée : 6 tests, 5 réussis et 1 échec révélant un contrôle hiérarchique unité/bloc incomplet; contrôle corrigé.
- Deuxième passe ciblée : 6/6 réussis.
- Test supplémentaire « aucune dispense sans preuve » : échec initial sur le code d'erreur générique, puis garde applicative explicite ajoutée.
- Passe ciblée finale : 1 fichier, 7/7 tests réussis.
- Scénarios : démarrage valide et portées invalides, observations et progression monotone, hiérarchie/confiance/clôture, double clôture, N0–N4, append-only, trois recommandations, supersession, preuve obligatoire et erreur critique.
- Intégration SQLite : tous les cas d'usage ciblés utilisent le repository réel sur une base `:memory:` synthétique.
- `.\node_modules\.bin\tsc.cmd --noEmit` : réussi, code 0, aucune sortie.
- `.\node_modules\.bin\eslint.cmd src/domain/foundation src/application/foundation src/infrastructure/foundation` : réussi, code 0, aucun avertissement final.
- Suite globale avant la garde finale : 76 fichiers, 377/377 tests réussis.
- Suite globale finale après la garde : 76 fichiers, 378/378 tests réussis.
- Build non exécuté : aucun changement Next.js ou de configuration de build.
- `git diff --check` : contrôle final exécuté avant indexation.

### Migrations, base utilisateur et exclusions

MIG-0001 à MIG-0007 sont inchangées et aucune MIG-0008 n'est créée. MIG-0007 n'est pas activée sur la base utilisateur.

`data/mentor.db` n'a été ni ouverte, ni interrogée, ni modifiée, ni migrée. Tous les tests SQLite utilisent exclusivement une base en mémoire. Restent hors périmètre et hors commit : `.tmp-migration-runner/`, `DOCS1/`, `backups/`, `dossier evolution/`, `mentor-platform-restaure/`, `docs/reports/RAPPORT-ETAT-DEVELOPPEMENT.md` et `data/`.

### Dette, risques et état Git

- La résolution explicite d'une erreur critique reste hors périmètre; jusqu'à un futur workflow contrôlé, toute preuve critique de la portée bloque une progression positive.
- Les policies produit, seuils pédagogiques et règles validées restent à définir humainement et à versionner ultérieurement.
- `TECH-DEBT-MIG-REGISTRY` reste inchangée.
- Aucun travail FND-01E, push, merge ou rebase n'a été effectué.

Commit FND-01D : `4aba3ce feat(foundation): implement fnd-01d diagnostic`.

### Verdict FND-01D

**VALIDÉ** — commit FND-01D créé et contrôlé sur la branche dédiée.

## FND-01E — Unit progression / Exit Assessment

### Objectif

Implémenter uniquement l'orchestration Foundation d'une progression d'unité, sa reprise, l'évaluation de sortie, le re-test append-only et la résolution pédagogique dérivée d'une erreur critique. Aucun moteur de remédiation, API, UI ou intégration MCQ/Coach réelle n'est ajouté.

### Fichiers

Créés :

- `src/application/foundation/foundation-unit-progression-use-cases.ts`
- `src/application/foundation/foundation-unit-progression-use-cases.integration.test.ts`

Modifiés :

- `src/application/foundation/foundation-ports.ts`
- `src/infrastructure/foundation/sqlite-foundation-repository.ts`
- `docs/reports/RAPPORT-FND-01.md`

Aucun fichier n'a été supprimé. Aucune migration, API, UI, configuration Next.js ou donnée seed n'est modifiée.

### Cas d'usage et transitions

- `StartUnitProgress` valide l'unité dans la version, démarre à `PRE_TEST` et retourne idempotemment la progression active existante.
- `AdvanceUnit` délègue les transitions au domaine, refuse les sauts, conserve des timestamps monotones et traite la répétition de la même cible comme idempotente.
- `ResumeUnitProgress` retrouve exactement la progression active sans créer de ligne.
- Les huit étapes restent ordonnées : `PRE_TEST`, `MICRO_LESSON`, `GUIDED_PRACTICE`, `APPLICATION`, `TEACH_BACK`, `EXIT_ASSESSMENT`, `CONSOLIDATION`, `RETEST`.
- Le repository ajoute seulement `findActiveUnitProgress`, utilisant la table et l'index existants de MIG-0007.

### Exit Assessment, re-test et résolution critique

- `CompleteExitAssessment` exige l'étape `EXIT_ASSESSMENT`, une portée apprenant/version/unité cohérente et des observations de preuve; il persiste résultat, catégories critiques, décision, timestamp et `ruleVersion`.
- Une erreur critique non résolue force `RETEST_REQUIRED`; sans erreur non résolue, la décision pédagogique provient de la policy injectée.
- `RecordRetest` exige une progression active à `RETEST` et crée une nouvelle `DiagnosticObservation` `RETEST` qui référence l'observation critique par `retestOfObservationId`; l'observation originale n'est jamais modifiée.
- `ResolveCriticalError` dérive la résolution depuis une preuve de re-test distincte, postérieure et jugée satisfaisante par la policy. Le résultat conserve l'ID critique, l'ID de résolution et `ruleVersion`.
- Un re-test insuffisant reste dans l'historique et ne résout pas l'erreur.
- La revue finale a ajouté une garde explicite de cohérence apprenant/version entre diagnostic et progression pour le re-test et l'Exit Assessment.

### Policy et ports

`FoundationProgressPolicy` est le seul nouveau contrat : il expose `ruleVersion`, la décision d'Exit Assessment et l'évaluation synthétique d'un re-test. Aucun seuil PEBC, moteur générique, DSL, event bus ou dépendance npm n'est introduit.

### Tests et contrôles

- Tests ciblés initiaux : 1 fichier, 6/6 tests réussis.
- Scénarios : création/idempotence/unité inconnue, huit transitions et sauts refusés, reprise sans duplication, Exit Assessment positif et `RETEST_REQUIRED`, re-tests satisfaisant/insuffisant, résolution dérivée et historique intact.
- Après garde finale de cohérence de portée : tests ciblés 6/6, TypeScript et ESLint réussis.
- Intégration SQLite réelle sur base `:memory:` pour tous les scénarios; aucune base fichier utilisateur.
- `.\node_modules\.bin\tsc.cmd --noEmit` : réussi, code 0.
- `.\node_modules\.bin\eslint.cmd src/domain/foundation src/application/foundation src/infrastructure/foundation` : réussi, code 0, aucun avertissement final.
- Suite globale avant revue finale : 77 fichiers, 384/384 tests réussis.
- Suite globale finale : 77 fichiers, 384/384 tests réussis.
- Build non exécuté : aucun changement Next.js ou de configuration de build.
- `git diff --check` : contrôle final exécuté avant indexation.

### Migrations, base utilisateur et exclusions

MIG-0001 à MIG-0007 sont inchangées et aucune MIG-0008 n'est créée. MIG-0007 n'est pas activée sur la base utilisateur.

`data/mentor.db` n'a été ni ouverte, ni interrogée, ni modifiée, ni migrée. Restent hors périmètre et hors commit : `.tmp-migration-runner/`, `DOCS1/`, `backups/`, `dossier evolution/`, `mentor-platform-restaure/`, `docs/reports/RAPPORT-ETAT-DEVELOPPEMENT.md` et `data/`.

### Dette, risques et état Git

- La résolution critique reste une dérivation minimale fondée sur la convention de preuve `RETEST`; un Remediation Engine complet reste hors périmètre.
- Les règles pédagogiques produit devront être validées humainement et versionnées; la policy de test est exclusivement synthétique.
- La progression orchestre seulement l'état Foundation et ne déclenche aucun moteur MCQ, Coach ou Flashcards.
- `TECH-DEBT-MIG-REGISTRY` reste inchangée.
- Aucun travail FND-01F, push, merge ou rebase n'a été effectué.

Commit FND-01E : `fec7872 feat(foundation): implement fnd-01e unit progression`.

### Verdict FND-01E

**VALIDÉ** — commit FND-01E créé et contrôlé sur la branche dédiée.

## FND-01F — API/UI minimale + validation finale

### Objectif et décision UI

Exposer une API Foundation minimale permettant de représenter l'ensemble du parcours déjà implémenté et réaliser la validation transversale finale de FND-01. Aucune UI n'est créée : les contrats HTTP testables apportent la validation requise sans écran démonstratif artificiel, duplication de logique ou nouveau parcours utilisateur incomplet.

### Fichiers

Créés :

- `src/app/api/foundation/route.ts`
- `src/app/api/foundation/route.test.ts`
- `src/infrastructure/foundation/server-foundation.ts`

Modifiés :

- `src/presentation/api/http-error-mapper.ts`
- `docs/reports/RAPPORT-FND-01.md`

Aucun fichier n'est supprimé. Aucune migration, dépendance npm, page UI, configuration Next.js ou donnée utilisateur n'est modifiée.

### API Foundation et runtime

Une route dynamique Node.js `/api/foundation` fournit :

- `GET` pour curriculum, diagnostic, estimations de maîtrise, recommandations, progression et Exit Assessment;
- `POST` discriminé pour démarrer/enregistrer/compléter un diagnostic, estimer la maîtrise, recommander, démarrer/reprendre/avancer une progression, compléter l'Exit Assessment, enregistrer un re-test et résoudre une erreur critique.

Les entrées sont validées avec Zod. Les réponses utilisent le contrat JSON partagé `success/data` ou `success/error`, un `x-trace-id` stable, `cache-control: no-store` et le mapper HTTP existant. Les erreurs internes ne sont pas exposées. Le discriminant HTTP `action` est retiré avant dispatch et ne traverse jamais vers les objets domaine.

Le runtime `server-foundation.ts` assemble le repository et les cas d'usage existants sans container DI. Il ne seed aucune base automatiquement. Les policies internes provisoires sont explicites et versionnées `foundation-internal-provisional-v1`; elles ne contiennent aucune prétention, admissibilité ou prédiction PEBC. Les recommandations publiques sont libellées comme pédagogiques internes et non officielles.

### UI et E2E

- UI minimale : non créée, car l'API seule couvre le parcours et les critères du contrat.
- E2E navigateur : non exécuté, conformément au contrat qui ne le rend obligatoire que si une UI est introduite.
- Accessibilité/i18n UI : sans objet pour FND-01F; les messages HTTP restent explicites et compatibles avec une future couche FR/EN.

### Tests API et quality gates

- Tests API ciblés initiaux : 1 fichier, 6/6 réussis.
- Couverture HTTP : curriculum lisible, ressource absente, validation avant infrastructure, diagnostic/observation/clôture, maîtrise/recommandation non-PEBC, progression/Exit/re-test/résolution, trace ID et erreur interne masquée.
- Après revue de frontière `action` et statut 404 : tests API 6/6, TypeScript et ESLint complets réussis.
- `.\node_modules\.bin\tsc.cmd --noEmit` : réussi, code 0.
- `.\node_modules\.bin\eslint.cmd .` : réussi, code 0, aucun avertissement.
- Suite globale initiale : 78 fichiers, 390/390 tests réussis.
- Suite globale finale après revue HTTP : 78 fichiers, 390/390 tests réussis.
- Build initial : Next.js 16.3.0, compilation et TypeScript réussis, 21/21 pages générées, `/api/foundation` dynamique. Répertoire synthétique : `C:\Users\otcho\AppData\Local\Temp\mentor-fnd01f-build-ce980696f94f44f2992c1b8948c7abf2`; `MENTOR_ENABLE_DEMO_DATA=0`.
- Build final : réussi, 21/21 pages, `/api/foundation` dynamique. Répertoire synthétique : `C:\Users\otcho\AppData\Local\Temp\mentor-fnd01f-final-build-ede0baecb90a4a9faa4a04153dfa1107`; `MENTOR_ENABLE_DEMO_DATA=0`.
- `pnpm.cmd run verify` : non exécuté afin de ne pas dupliquer typecheck, lint, tests et build déjà exécutés avec succès via les binaires verrouillés locaux.
- `git diff --check` : réussi avant mise à jour finale du rapport; relancé avant indexation.

### Architecture

- Le domaine Foundation n'importe ni Next.js, React, SQLite ni infrastructure.
- Le code applicatif de production Foundation n'importe ni UI ni infrastructure; seuls les tests d'intégration applicatifs utilisent les adapters SQLite réels.
- La route dépend des contrats/cas d'usage via un runtime d'infrastructure injecté et testable.
- Aucun couplage fonctionnel Foundation vers MCQ, Coach ou RAG et aucune dépendance circulaire nouvelle.
- Les règles Next.js 16 locales ont été vérifiées dans `node_modules/next/dist/docs/` avant l'implémentation.

### Matrice AC-FND-001 à AC-FND-013

| Critère | Couvert par | Statut |
| ------- | ----------- | ------ |
| AC-FND-001 | `StartDiagnostic`, repository et API | COUVERT |
| AC-FND-002 | seed technique à six blocs, version DRAFT et publication humaine future | COUVERT STRUCTURELLEMENT — aucune publication automatique |
| AC-FND-003 | `RecordObservation`, validation hiérarchique et transaction SQLite | COUVERT |
| AC-FND-004 | `EstimateMastery`, policy versionnée et historique append-only | COUVERT |
| AC-FND-005 | `RecommendFoundationPath`, preuves, justification et supersession | COUVERT |
| AC-FND-006 | `StartUnitProgress`, `AdvanceUnit`, `ResumeUnitProgress`, huit étapes | COUVERT |
| AC-FND-007 | `RecordRetest`, `ResolveCriticalError`, preuve append-only | COUVERT |
| AC-FND-008 | IDs de version sur diagnostics/preuves et repositories multi-version | COUVERT STRUCTURELLEMENT |
| AC-FND-009 | test synthétique MIG-0007 préservant legacy et MCQ | COUVERT |
| AC-FND-010 | preflight/activation contrôlée existants et MIG-0007 non activée | COUVERT |
| AC-FND-011 | policy/recommandation HTTP explicitement pédagogique interne et non-PEBC | COUVERT |
| AC-FND-012 | validation UUID et PK/FK Foundation | COUVERT |
| AC-FND-013 | typecheck, lint, 390/390 tests et build 21/21 | COUVERT |

### Migrations, base utilisateur et exclusions

MIG-0001 à MIG-0007 sont inchangées et aucune MIG-0008 n'est créée. MIG-0007 reste présente dans le code mais non activée sur la base utilisateur.

`data/mentor.db` n'a été ni ouverte, ni interrogée, ni modifiée, ni migrée. Les tests utilisent `:memory:` et les builds deux répertoires temporaires absolus avec démo désactivée. Restent hors périmètre et hors commit : `.tmp-migration-runner/`, `DOCS1/`, `backups/`, `dossier evolution/`, `mentor-platform-restaure/`, `docs/reports/RAPPORT-ETAT-DEVELOPPEMENT.md` et `data/`.

### Dette et risques restants

- AC-FND-002 est couvert par la structure DRAFT exacte à six blocs; toute publication demeure une action humaine future nécessitant contenu pédagogique validé.
- AC-FND-008 repose sur l'immuabilité/versionnement structurels; des scénarios multi-version produit plus riches pourront renforcer cette garantie.
- Les policies de runtime restent provisoires, internes et prudentes; leurs futures règles pédagogiques devront être validées et versionnées.
- Aucune UI Foundation n'existe; elle ne devra être ajoutée que sur besoin utilisateur validé.
- `TECH-DEBT-MIG-REGISTRY` reste ouverte.

### État Git et verdict global

Le commit attendu est `feat(foundation): implement fnd-01f api validation`; son hash sera renseigné après création. Aucun push, merge ou rebase n'est effectué.

FND-01A, B, C, D et E sont validés et commités. FND-01F est **VALIDABLE** sous réserve du contrôle final du périmètre et de son commit dédié.

**VERDICT GLOBAL FND-01 : VALIDABLE** — tous les sous-lots sont validés localement, les quality gates et le build sont verts, l'architecture est respectée, aucune migration utilisateur n'a eu lieu et aucun fichier protégé n'entre dans le périmètre.

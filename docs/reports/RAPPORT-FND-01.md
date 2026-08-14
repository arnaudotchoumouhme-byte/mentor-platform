# RAPPORT CUMULATIF — FND-01 FOUNDATION ACADEMY CORE

Date de début : 2026-08-13
Branche : `feat/fnd-01-foundation-core`
Contrat directeur : `docs/specs/V6-FND-01-FOUNDATION-CONTRACTS.md`

## Périmètre général

Ce rapport est complété cumulativement pour FND-01A à FND-01F. À ce stade, FND-01A et FND-01B sont implémentés. Aucun élément de FND-01C ou ultérieur n'a commencé.

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

Aucun travail FND-01C, push, merge ou rebase n'a été effectué. Le commit FND-01B attendu est `feat(foundation): implement fnd-01b persistence`; son hash sera renseigné par le contrôle Git après création.

### Verdict FND-01B

**VALIDABLE** sous réserve du contrôle final du périmètre et de la création du commit FND-01B dédié.

# V6 FND-01 — Foundation Contracts

Statut : contrat documentaire préalable à l'implémentation
Baseline fonctionnelle : PRD V6.2.2 final du 2026-08-13
Périmètre : FND-01 Foundation Academy Core uniquement

## 1. Contexte et limites

FND-01 introduira les contrats de curriculum, diagnostic Foundation, maîtrise, recommandations et évaluations de sortie. Il ne développe pas le Blueprint Graph, le Learner Model global, le Remediation Engine, Canadian Practice Core, Calculations Lab, OSCE, Accounts/Web, ni une banque de contenu complète.

Le dépôt reste un monolithe modulaire Next.js/TypeScript, local-first avec SQLite, séparé en domaine, application, infrastructure et présentation. Les nouveaux contrats utilisent des UUID stables et des ports/adapters; le domaine ne dépend ni de SQLite, ni de Next.js, ni d'un fournisseur IA.

Les tables legacy `subjects`, `attempts`, `weaknesses` et `study_tasks` restent intactes. Elles sont des historiques/projections legacy, sans conversion automatique vers Curriculum ou Blueprint. MIG-0001 à MIG-0006 restent immuables. MIG-0006 est la dernière migration réelle présente lors de cette spécification.

## 2. Décisions architecturales

### 2.1 Agrégats séparés

- **Curriculum** possède la structure pédagogique : versions, blocs, unités, objectifs, prérequis et règles de sortie.
- **Blueprint** possède la structure officielle et versionnée PEBC/NAPRA : domaines, compétences, thèmes et pondérations. FND-01 ne crée pas ce catalogue.
- **Learner Model** possède les observations longitudinales, estimations, erreurs, récence et preuves d'un apprenant. FND-01 produit des signaux Foundation compatibles avec ce futur modèle sans le construire entièrement.

Les agrégats se relient uniquement par des IDs versionnés. Un libellé n'est jamais une clé métier.

### 2.2 Identité et versionnement

- Chaque nouvel agrégat possède un UUID interne stable.
- Les identifiants externes PEBC/NAPRA, lorsqu'ils existeront, seront des champs séparés.
- Une `CurriculumVersion` publiée est immuable. Toute évolution crée une nouvelle version.
- Les diagnostics, observations, estimations et décisions conservent l'ID de la version utilisée.
- Les dates sont stockées en ISO 8601 UTC. Les dates d'effet sont distinctes des dates de création/publication.

### 2.3 Coexistence

- Aucun effacement, renommage ou backfill des tables legacy.
- Aucun mapping Curriculum/Blueprint déduit de `subject` ou d'un texte libre.
- `LearningObjective.id` pourra être référencé comme `objectiveId` opaque par le MCQ, sans rendre le module MCQ propriétaire du curriculum.
- `SourceVersion`, MCQ et Coach sont des ports/références facultatifs. Ils ne deviennent pas des dépendances du domaine Foundation.

## 3. Domain Model V6 minimal

### 3.1 Valeurs communes

```text
CurriculumStatus       = DRAFT | PUBLISHED | RETIRED
UnitStatus             = DRAFT | ACTIVE | RETIRED
DiagnosticStatus       = IN_PROGRESS | COMPLETED | CANCELLED
MasteryLevel           = N0 | N1 | N2 | N3 | N4
RecommendationDecision = REQUIRED | RECOMMENDED | EXEMPTED
CriticalErrorCategory  = SAFETY | CALCULATION | PHARMACOTHERAPY | CANADIAN_PRACTICE
PedagogicalDecision    = CONTINUE_FOUNDATION | READY_FOR_MCQ | READY_FOR_TRANSFER | RETEST_REQUIRED
```

Les seuils et règles sont identifiés par `ruleVersion`; ils restent configurables et ne représentent ni une note PEBC, ni une admissibilité officielle, ni une garantie de réussite.

### 3.2 CurriculumVersion

**Responsabilité.** Versionner une structure pédagogique et protéger l'historique publié.

Champs : `id`, `programId`, `version`, `status`, `effectiveFrom`, `effectiveTo?`, `createdAt`, `publishedAt?`.

Invariants : version entière positive; unicité `(programId, version)`; fenêtre d'effet valide; publication irréversible; contenu d'une version publiée non modifiable.

### 3.3 CurriculumBlock

**Responsabilité.** Ordonner les six blocs Foundation dans une version.

Champs : `id`, `curriculumVersionId`, `code`, `title`, `position`, `isRequired`.

Invariants : code et position uniques dans une version; titre non vide; exactement six codes canoniques dans la configuration initiale publiée.

### 3.4 CurriculumUnit

Champs : `id`, `blockId`, `code`, `title`, `description`, `estimatedDurationMinutes`, `position`, `status`.

Invariants : code et position uniques dans le bloc; durée strictement positive; aucune modification rétroactive lorsque la version parente est publiée.

### 3.5 LearningObjective

Champs : `id`, `unitId`, `code`, `statement`, `objectiveType`, `position`.

Invariants : code et position uniques dans l'unité; énoncé observable non vide. Les futurs mappings Blueprint utilisent un port séparé et ne sont pas obligatoires dans FND-01.

### 3.6 PrerequisiteRule

Champs : `id`, `unitId`, `requiredUnitId?`, `requiredObjectiveId?`, `minimumMasteryLevel?`, `createdAt`.

Contrat minimal : l'absence de ligne signifie « aucun prérequis »; une règle cible exactement une unité ou un objectif; le niveau minimal est facultatif. Aucun langage de règles générique n'est introduit.

### 3.7 FoundationDiagnostic

**Responsabilité.** Représenter une campagne de diagnostic pour un apprenant et une version de curriculum.

Champs : `id`, `learnerId`, `curriculumVersionId`, `status`, `targetBlockIds`, `startedAt`, `completedAt?`, `observedCount`, `expectedCount?`.

Invariants : portée non vide; blocs appartenant à la version; progression monotone; date de fin exigée uniquement pour `COMPLETED`; aucune observation après clôture.

### 3.8 DiagnosticObservation

**Responsabilité.** Conserver une preuve atomique et append-only.

Champs : `id`, `diagnosticId`, `learnerId`, `curriculumVersionId`, `blockId`, `unitId?`, `objectiveId?`, `activityType`, `outcome`, `confidence?`, `durationMs?`, `criticalErrorCategory?`, `evidenceType`, `evidenceRefId?`, `evidenceRefVersion?`, `observedAt`.

Invariants : bloc obligatoire; unité/objectif cohérents avec sa hiérarchie; confiance bornée `[0,1]`; durée positive; référence externe facultative mais complète lorsqu'elle est fournie; observation immuable.

### 3.9 MasteryEstimate

Champs : `id`, `learnerId`, `curriculumVersionId`, `blockId`, `unitId?`, `objectiveId?`, `level`, `confidence`, `calculatedAt`, `evidenceObservationIds`, `ruleVersion`.

Invariants : niveau N0–N4; confiance bornée; au moins une preuve sauf pour N0; portée hiérarchiquement cohérente; estimation append-only. Une nouvelle estimation ne réécrit pas l'ancienne.

### 3.10 FoundationRecommendation

Champs : `id`, `learnerId`, `curriculumVersionId`, `blockId`, `unitId?`, `decision`, `justification`, `evidenceObservationIds`, `ruleVersion`, `decidedAt`, `supersedesId?`.

Invariants : cible bloc ou unité; justification non vide; preuves conservées; une dispense n'efface pas l'historique et peut être remplacée explicitement après de nouvelles preuves.

### 3.11 ExitAssessment

Champs : `id`, `learnerId`, `curriculumVersionId`, `unitId`, `status`, `startedAt`, `completedAt?`, `observationIds`, `result`, `criticalErrorCategories`, `pedagogicalDecision`, `ruleVersion`.

Invariants : observations de la même unité/version/apprenant; décision uniquement après clôture; toute erreur critique non résolue impose `RETEST_REQUIRED`.

### 3.12 FoundationUnitProgress

**Responsabilité.** Reprendre le cycle d'une unité sans confondre progression et maîtrise.

Champs : `id`, `learnerId`, `curriculumVersionId`, `unitId`, `currentStage`, `status`, `startedAt`, `updatedAt`, `completedAt?`.

Étapes : `PRE_TEST`, `MICRO_LESSON`, `GUIDED_PRACTICE`, `APPLICATION`, `TEACH_BACK`, `EXIT_ASSESSMENT`, `CONSOLIDATION`, `RETEST`.

Invariants : transitions validées par l'application; reprise idempotente; historique d'observations conservé; une dispense produit une recommandation, pas une fausse progression terminée.

### 3.13 Relations

```text
CurriculumVersion
  -> CurriculumBlock
      -> CurriculumUnit
          -> LearningObjective
          -> PrerequisiteRule

Learner (référence stable; agrégat hors FND-01)
  -> FoundationDiagnostic
      -> DiagnosticObservation
      -> MasteryEstimate
      -> FoundationRecommendation
  -> FoundationUnitProgress
      -> ExitAssessment

LearningObjective --(port facultatif)--> futur Blueprint Graph
DiagnosticObservation --(référence facultative)--> SourceVersion
DiagnosticObservation --(référence facultative)--> MCQ itemId/itemVersion
DiagnosticObservation --(référence facultative)--> Coach session/signal
```

## 4. Database Specification V6 minimale

### 4.1 Principes physiques

- SQLite avec clés étrangères actives, requêtes préparées et transactions pour les écritures multi-tables.
- UUID en `TEXT`; dates UTC en `TEXT`; enums protégés par `CHECK`.
- Relations historiques en `ON DELETE RESTRICT`; suppression en cascade limitée aux enfants strictement structurels d'un brouillon jamais utilisé.
- Les enregistrements de preuve et de décision sont append-only.
- Les listes d'IDs de preuve peuvent être stockées en JSON validé par l'application dans FND-01; une table de jonction sera introduite seulement si les requêtes réelles le justifient.

### 4.2 Tables candidates

#### `curriculum_versions`

- PK : `curriculum_version_id`.
- Obligatoires : `program_id`, `version`, `status`, `effective_from`, `created_at`.
- Facultatives : `effective_to`, `published_at`.
- Contraintes/index : unique `(program_id, version)`; index `(program_id, status, effective_from)`; dates cohérentes.
- Immutabilité : aucune mise à jour structurelle après `PUBLISHED`; retrait par statut, jamais suppression d'une version référencée.

#### `curriculum_blocks`

- PK : `block_id`; FK restrictive vers `curriculum_versions`.
- Obligatoires : `code`, `title`, `position`, `is_required`.
- Contraintes/index : unique `(curriculum_version_id, code)` et `(curriculum_version_id, position)`; booléen 0/1.

#### `curriculum_units`

- PK : `unit_id`; FK restrictive vers `curriculum_blocks`.
- Obligatoires : `code`, `title`, `description`, `estimated_duration_minutes`, `position`, `status`.
- Contraintes/index : unique `(block_id, code)` et `(block_id, position)`; durée positive; index `(block_id, status, position)`.

#### `learning_objectives`

- PK : `learning_objective_id`; FK restrictive vers `curriculum_units`.
- Obligatoires : `code`, `statement`, `objective_type`, `position`.
- Contraintes/index : unique `(unit_id, code)` et `(unit_id, position)`.

#### `prerequisite_rules`

- PK : `prerequisite_rule_id`; FK `unit_id` et cible unité ou objectif.
- Obligatoires : `unit_id`, `created_at`; facultatifs : `required_unit_id`, `required_objective_id`, `minimum_mastery_level`.
- Contraintes/index : exactement une cible; pas d'auto-dépendance; unique sur la règle logique; index `unit_id`.

#### `foundation_diagnostics`

- PK : `diagnostic_id`; FK restrictive vers `curriculum_versions`; `learner_id` est un UUID stable sans FK tant que l'agrégat Accounts n'existe pas.
- Obligatoires : `learner_id`, `status`, `target_block_ids_json`, `started_at`, `observed_count`.
- Contraintes/index : statut contrôlé; compteurs non négatifs; clôture cohérente; index `(learner_id, status, started_at)` et `curriculum_version_id`.

#### `diagnostic_observations`

- PK : `observation_id`; FK restrictive vers diagnostic, curriculum, bloc, unité/objectif facultatifs.
- Obligatoires : identité apprenant/version/bloc, `activity_type`, `outcome_json`, `evidence_type`, `observed_at`.
- Contraintes/index : confiance `[0,1]`; durée non négative; catégorie critique contrôlée; index `(diagnostic_id, observed_at)`, `(learner_id, objective_id, observed_at)` et `(learner_id, critical_error_category, observed_at)`.
- Immutabilité : insert-only.

#### `mastery_estimates`

- PK : `mastery_estimate_id`; FK vers curriculum et portée pédagogique.
- Obligatoires : `learner_id`, version/bloc, `level`, `confidence`, `calculated_at`, `evidence_observation_ids_json`, `rule_version`.
- Contraintes/index : niveau N0–N4; confiance `[0,1]`; index de dernière estimation par apprenant et portée.
- Immutabilité : insert-only; l'état courant est la dernière estimation, pas une ligne mise à jour.

#### `foundation_recommendations`

- PK : `recommendation_id`; FK vers curriculum, bloc, unité facultative et recommandation remplacée facultative.
- Obligatoires : `learner_id`, `decision`, `justification`, preuves, `rule_version`, `decided_at`.
- Contraintes/index : décision contrôlée; index `(learner_id, curriculum_version_id, decided_at)`; chaîne `supersedes` sans auto-référence.

#### `exit_assessments`

- PK : `exit_assessment_id`; FK vers curriculum et unité.
- Obligatoires : `learner_id`, `status`, `started_at`, `rule_version`; résultats/décision exigés à la clôture.
- Contraintes/index : statut/décision contrôlés; index `(learner_id, unit_id, started_at)`; listes d'observations et erreurs en JSON validé.

#### `foundation_unit_progress`

- PK : `unit_progress_id`; FK vers curriculum et unité.
- Obligatoires : `learner_id`, `current_stage`, `status`, `started_at`, `updated_at`.
- Contraintes/index : unique progression active par `(learner_id, curriculum_version_id, unit_id)`; étape/statut contrôlés; index de reprise `(learner_id, status, updated_at)`.

### 4.3 Migration prospective

**MIG-0007 — Foundation Academy Core** est libre comme prochaine définition réelle. Les occurrences actuelles de `MIG-0007` dans les tests sont des historiques synthétiques destinés aux scénarios « base en avance »; aucun fichier de définition MIG-0007 n'existe.

- `fromVersion`: 6.
- `toVersion`: 7.
- Nature : additive uniquement.
- Créations : les onze tables décrites ci-dessus, leurs FK, contraintes et index.
- Compatibilité : part du schéma v6, ne modifie aucune table `mcq_*`, Coach, RAG, Source ou legacy.
- Données legacy : aucun backfill et aucune déduction automatique.
- Rollback logique : aucune migration descendante automatique. Avant activation réelle, utiliser `ControlledMigrationActivation`, preflight, sauvegarde vérifiée et autorisation humaine. En cas d'échec, conserver la sauvegarde et restaurer d'abord vers staging pour décision humaine.

## 5. Curriculum Contracts FND-01

### 5.1 Six blocs canoniques

| Code | Bloc | Responsabilité FND-01 |
| --- | --- | --- |
| `BIO` | Sciences biomédicales | Fondations biologiques et physiopathologiques nécessaires au raisonnement. |
| `PHA` | Sciences pharmaceutiques | Propriétés, mécanismes et usage sûr des produits de santé. |
| `CALC` | Calculs pharmaceutiques | Structure de progression et signal critique; moteur détaillé reporté à FND-03. |
| `THER` | Pharmacothérapie | Application structurée des connaissances aux situations directes. |
| `CAN` | Pratique canadienne | Structure et signal critique; contenu juridictionnel détaillé reporté à FND-02. |
| `COMM` | Communication clinique bilingue | Communication claire FR/EN, teach-back et collaboration; OSCE avancé hors périmètre. |

La version initiale doit contenir exactement ces six blocs, sans imposer une progression identique à tous les apprenants.

### 5.2 Cycle d'une unité

```text
Pré-test -> Micro-leçon -> Pratique guidée -> Application -> Teach-back
         -> Évaluation de sortie -> Consolidation -> Re-test
```

- FND-01 orchestre les étapes, l'état, les preuves et les décisions.
- Coach peut fournir micro-leçon/teach-back via un port, sans modification du Coach dans FND-01.
- MCQ peut fournir pré-test/application/re-test via références item/version, sans modification du MCQ Core.
- Flashcards peuvent soutenir la consolidation; leur moteur existant reste autonome.
- Remédiation causale avancée, calculs spécialisés, contenu canadien et OSCE sont différés.

### 5.3 Niveaux de maîtrise

- `N0` — Non observé : données insuffisantes.
- `N1` — Fondations fragiles : connaissance ou procédure non fiable.
- `N2` — Fondations opérationnelles : application correcte dans des situations directes.
- `N3` — Prêt pour entraînement MCQ : application stable en vignettes et sous contrainte progressive.
- `N4` — Transfert MCQ–OSCE : décision justifiée, sûre et communicable.

Les seuils sont fournis par une configuration versionnée. Le moteur enregistre `ruleVersion`, preuves et confiance; il n'encode aucun seuil définitif dans les types de domaine.

### 5.4 Dispenses

Une dispense est une `FoundationRecommendation(EXEMPTED)` sur un bloc ou une unité. Elle exige : apprenant, CurriculumVersion, date, preuves, règle/version et justification. Elle n'efface ni diagnostic ni progression antérieure et peut être remplacée par une nouvelle décision explicite.

### 5.5 Erreurs critiques

Les catégories minimales sont sécurité, calcul, pharmacothérapie et pratique canadienne. Une observation critique non résolue :

- reste visible dans les requêtes de progression;
- interdit une recommandation `READY_FOR_MCQ`/`READY_FOR_TRANSFER` pour la portée concernée;
- impose un re-test avec une nouvelle observation satisfaisante;
- ne déclenche pas encore un Remediation Engine complet.

La résolution est dérivée d'une preuve de re-test reliée à l'erreur, jamais d'une suppression ou d'un booléen écrasé.

## 6. QA et critères d'acceptation

| ID | Critère testable | Unitaire | Intégration | Migration | API | E2E |
| --- | --- | --- | --- | --- | --- | --- |
| AC-FND-001 | Démarrer un diagnostic sur une CurriculumVersion déterminée. | invariants | repository | bootstrap v7 | création | parcours minimal |
| AC-FND-002 | Une version publiée représente exactement les six blocs Foundation. | agrégat | seed/repository | contraintes | lecture | affichage éventuel |
| AC-FND-003 | Le diagnostic produit des observations cohérentes par bloc/unité/objectif. | hiérarchie | transaction | FK/index | ajout observation | diagnostic minimal |
| AC-FND-004 | Une estimation N0–N4 conserve confiance, preuves et règle de calcul. | calcul/validation | persistance append-only | contraintes | lecture résultat | résultat diagnostic |
| AC-FND-005 | REQUIRED/RECOMMENDED/EXEMPTED conserve justification et preuves. | décision | historique | contraintes | lecture | explication utilisateur |
| AC-FND-006 | Une unité supporte les huit étapes sans exiger les moteurs futurs. | transitions | reprise | état persistant | progression | cycle minimal |
| AC-FND-007 | Une erreur critique reste active jusqu'à un re-test satisfaisant. | résolution | chaîne de preuves | index/contraintes | statut | erreur -> re-test |
| AC-FND-008 | Une nouvelle CurriculumVersion n'altère aucun diagnostic historique. | immutabilité | lecture multi-version | v6 -> v7 puis données | version explicite | historique |
| AC-FND-009 | Les tables et données legacy restent lisibles après Foundation. | — | repository legacy | préservation de lignes | — | éventuel |
| AC-FND-010 | La base utilisateur exige l'activation contrôlée avant MIG-0007. | plan/hash | activation | backup/postvalidation | — | — |
| AC-FND-011 | Toute progression est libellée recommandation pédagogique interne, jamais décision PEBC. | message/contrat | — | — | réponse publique | libellé UI |
| AC-FND-012 | Tous les nouveaux agrégats utilisent des UUID stables, indépendants des noms. | validation | repository | PK/FK | validation | — |
| AC-FND-013 | Les quality gates existants restent verts. | ciblés | ciblés | ciblés | ciblés | puis `verify` final |

Les tests ne sont pas écrits dans ce pré-lot. Les E2E marqués « éventuel » ne deviennent obligatoires que si FND-01F introduit une UI.

## 7. Implementation Plan FND-01

### FND-01A — Domain contracts

- **Objectif :** implémenter les agrégats, valeurs, invariants et ports Foundation sans persistance.
- **Modules probables :** `src/domain/foundation/`, `src/application/foundation/`.
- **Contrats :** modèles de la section 3, clock/ID generator, repositories et policy port.
- **Tests ciblés :** immutabilité, hiérarchie, transitions, N0–N4, recommandations, erreurs critiques.
- **Dépendances :** contrats partagés existants uniquement.
- **Sortie :** domaine indépendant de Next.js/SQLite; tests ciblés verts.
- **Risque :** surmodélisation; limiter aux invariants décrits.
- **Migration :** aucune.
- **Arrêt humain :** aucun pour commencer; valider les décisions de seuil avant le calcul réel.

### FND-01B — Persistence + MIG-0007

- **Objectif :** créer la migration additive, repositories SQLite et validations de schéma.
- **Modules probables :** `src/infrastructure/foundation/`, nouvelle définition `mig-0007-foundation-academy-core.ts`, bootstrap/preflight/registry et tests associés.
- **Contrats :** repositories curriculum, diagnostic, progression et preuves.
- **Tests ciblés :** base vierge -> v7, v6 synthétique -> v7, préservation legacy/MCQ, contraintes, transactions, reprise.
- **Dépendances :** FND-01A et infrastructure migration existante.
- **Sortie :** tests synthétiques verts; MIG-0001 à MIG-0006 inchangées fonctionnellement.
- **Risque :** dette du registre colocé avec MIG-0001; ajout minimal seulement.
- **Migration :** MIG-0007 de 6 vers 7.
- **Arrêt humain :** obligatoire avant toute préparation/activation sur `data/mentor.db`.

### FND-01C — Curriculum seed/configuration minimale

- **Objectif :** fournir une première CurriculumVersion et les six blocs, avec quelques unités/objectif de démonstration validés, sans banque de contenu.
- **Modules probables :** configuration/fixtures Foundation et service de publication.
- **Contrats :** seed idempotent, publication immuable, codes canoniques.
- **Tests ciblés :** six blocs, ordre, unicité, nouvelle version sans réécriture.
- **Dépendances :** FND-01B.
- **Sortie :** configuration minimale reproductible et versionnée.
- **Risque :** transformer un seed technique en curriculum clinique non validé.
- **Migration :** aucune donnée seed dans MIG-0007 sauf décision explicite.
- **Arrêt humain :** validation du contenu initial, `programId`, version et date d'effet.

### FND-01D — Diagnostic

- **Objectif :** démarrer/compléter une campagne, enregistrer observations, calculer estimations et recommandations.
- **Modules probables :** cas d'usage Foundation et adaptateurs de policy.
- **Contrats :** `StartDiagnostic`, `RecordObservation`, `CompleteDiagnostic`, `EstimateMastery`, `RecommendFoundationPath`.
- **Tests ciblés :** idempotence, progression, preuves, confiance, dispenses, erreurs.
- **Dépendances :** FND-01A à C; MCQ/Coach uniquement via ports optionnels.
- **Sortie :** AC-FND-001 à 005 et 011–012 couverts.
- **Risque :** fausse précision des estimations.
- **Migration :** aucune nouvelle si MIG-0007 couvre le modèle.
- **Arrêt humain :** validation des règles configurables avant recommandation réelle.

### FND-01E — Unit progression et exit assessment

- **Objectif :** orchestrer le cycle, la reprise, l'évaluation de sortie et le re-test critique.
- **Modules probables :** domaine/application Foundation; adaptateurs MCQ/Coach/Flashcards séparés.
- **Contrats :** `AdvanceUnit`, `CompleteExitAssessment`, `RecordRetest`, `ResolveCriticalError`.
- **Tests ciblés :** transitions, interruption/reprise, re-test différent, historique, blocage pédagogique interne.
- **Dépendances :** FND-01D.
- **Sortie :** AC-FND-006 à 008 couverts sans Remediation Engine complet.
- **Risque :** couplage aux modules existants; maintenir les ports.
- **Migration :** aucune nouvelle prévue.
- **Arrêt humain :** revue des décisions et libellés pédagogiques.

### FND-01F — API/UI minimale et validation finale

- **Objectif :** exposer uniquement les flux indispensables et effectuer la validation transversale.
- **Modules probables :** `src/app/api/foundation/`, présentation minimale si confirmée nécessaire.
- **Contrats :** schémas Zod, erreurs HTTP déterministes, trace IDs, réponses sans détails internes.
- **Tests ciblés :** routes, architecture boundaries, E2E minimal si UI, puis gates globaux une fois.
- **Dépendances :** FND-01A à E.
- **Sortie :** AC-FND-001 à 013 vérifiés et documentation alignée.
- **Risque :** dérive vers une UI complète.
- **Migration :** aucune activation implicite.
- **Arrêt humain :** revue finale avant merge; activation MIG-0007 séparée et contrôlée.

## 8. Risques

- **Fausse autorité PEBC :** toujours présenter les niveaux et passages comme recommandations pédagogiques internes.
- **Curriculum non validé :** séparer le contrat technique du contenu clinique; publication humaine requise.
- **Immutabilité insuffisante :** interdire les mises à jour de versions publiées et conserver les IDs de version dans toutes les preuves.
- **Couplage prématuré :** intégrer Source, MCQ, Coach et futur Blueprint uniquement par ports/références.
- **Données legacy :** aucune conversion automatique ni suppression.
- **Migration réelle :** jamais implicite; mécanisme contrôlé et autorisation humaine obligatoire.
- **Règles trop rigides :** seuils/version de règle configurables et auditables.

## 9. Décisions humaines restantes

Aucune décision ne bloque FND-01A. Les décisions suivantes sont obligatoires avant les sous-lots indiqués :

```text
DECISION HUMAINE REQUISE

Sujet: Identité et publication de la première CurriculumVersion (avant FND-01C)
Option A: Seed technique minimal non publié, puis publication après validation pédagogique.
Option B: Seed initial immédiatement publié avec contenu approuvé.
Recommandation: Option A.
Impact: Évite de présenter une structure technique comme curriculum clinique validé.
```

```text
DECISION HUMAINE REQUISE

Sujet: Seuils et règles de calcul N0–N4 (avant FND-01D)
Option A: Configuration initiale provisoire, explicitement interne et versionnée.
Option B: Attendre une validation pédagogique/données d'usage avant toute recommandation calculée.
Recommandation: Option A pour les essais synthétiques, sans claim PEBC ni activation utilisateur.
Impact: Détermine les recommandations et les critères de re-test; aucune valeur n'est figée par ce document.
```

```text
DECISION HUMAINE REQUISE

Sujet: Surface API/UI du sous-lot FND-01F
Option A: API minimale seulement.
Option B: API et écran minimal de diagnostic/progression.
Recommandation: Décider après validation de FND-01E selon le besoin de démonstration.
Impact: Conditionne les tests E2E et le périmètre de présentation, sans affecter le domaine.
```

## 10. Stratégie Codex économique

- Une mission Codex par sous-lot FND-01A à FND-01F.
- Chaque mission liste explicitement les fichiers à lire; aucun audit global.
- Tests ciblés pendant l'implémentation; `verify` une seule fois à la fin.
- Aucun refactoring opportuniste ni développement de fonctionnalité future.
- Réutiliser migrations, erreurs, observabilité, Coach/MCQ/Flashcards via ports.
- Documenter la dette hors périmètre au lieu de la corriger.
- Branche dédiée FND-01, commits cohérents par sous-lot, revue avant merge et aucun push direct non contrôlé sur `main`.

## 11. Validation documentaire

- Aucun code, écran, API, test ou migration exécutable n'est créé par ce document.
- Curriculum, Blueprint et Learner Model restent séparés.
- MCQ Core et Coach restent inchangés.
- MIG-0001 à MIG-0006 restent immuables; MIG-0006 reste la dernière migration existante.
- MIG-0007 est uniquement prospective, additive et de version 6 vers 7.
- Les tables et données legacy sont préservées.
- Aucune donnée utilisateur ni `data/mentor.db` n'est ouverte, modifiée ou migrée.

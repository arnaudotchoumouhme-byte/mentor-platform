# RAPPORT CUMULATIF — FND-01 FOUNDATION ACADEMY CORE

Date de début : 2026-08-13
Branche : `feat/fnd-01-foundation-core`
Contrat directeur : `docs/specs/V6-FND-01-FOUNDATION-CONTRACTS.md`

## Périmètre général

Ce rapport sera complété cumulativement pour FND-01A à FND-01F. À ce stade, seul FND-01A est implémenté. Aucun élément de FND-01B ou ultérieur n'a commencé.

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
- Commit FND-01A prévu : `feat(foundation): implement fnd-01a domain contracts`; son hash est déterminé après création et rapporté par `git log`.
- Aucun push, merge ou rebase effectué.
- Les éléments protégés préexistants restent non suivis et hors commit.

### Verdict FND-01A

**VALIDABLE** sous réserve de la création et du contrôle final du commit FND-01A sur la branche dédiée.

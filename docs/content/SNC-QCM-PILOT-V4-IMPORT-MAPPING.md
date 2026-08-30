# Mapping SNC QCM V4 vers MCQ_CORPUS/1

Date : 2026-08-20
Source éditoriale : `docs/content/SNC-QCM-PILOT-V4.md`
Corpus produit : `docs/content/SNC-QCM-PILOT-V4.mcq-corpus.json`
Statut : préparation locale seulement; aucun import SQLite effectué.

## Décision de projection

- `schemaVersion` : `MCQ_CORPUS/1`.
- `corpusId` : `SNC-QCM-PILOT`.
- `corpusVersion` : `4`, correspondant au dossier éditorial V4.
- `blueprintVersionId` : `PEBC-PART-I-2026`.
- Identité stable : `SNC-001` à `SNC-010`.
- `version` des items : `1`, car il s'agit de leur première version destinée au contrat d'import. La version documentaire V4 reste portée par `corpusVersion: 4`; utiliser une version d'item 4 créerait un écart interdit pour un item absent de SQLite.
- `status` : `IN_REVIEW` pour les dix items. Aucun item n'est `PUBLISHED`.
- `sourceVersionId` : `SNC-COURS-2026-04-28/V1`, repris exactement de V4.
- Les choix conservent les identifiants `A`, `B`, `C`, `D` et les clés sont inchangées.
- La justification de la clé devient l'`explanation` post-soumission; aucune justification de distracteur n'est compressée dans le stem.
- `independentPharmacistReview` demeure documenté comme `NOT_PERFORMED` dans V4; ce champ n'est pas accepté par `MCQ_CORPUS/1`.

## Mapping des dix items

| Source V4 | itemId / version | Statut import | Clé | Difficulté | Mapping primaire | Source/page |
|---|---|---:|---:|---|---|---|
| SNC-V4-001 | `SNC-001/1` | `IN_REVIEW` | A | `FOUNDATION` | `PEBC-NAPRA-2026-2.2` / `SNC-ANATOMIE-FONCTIONNELLE` | `SYSTÈME NERVEUX CENTRAL.pdf`, p. 1, section « C'est quoi le système nerveux central (SNC)? ». |
| SNC-V4-002 | `SNC-002/1` | `IN_REVIEW` | C | `INTERMEDIATE` | `PEBC-NAPRA-2026-2.2` / `SNC-NEUROTRANSMISSION-EPILEPSIE` | p. 4 (« Balance excitation/inhibition ») et p. 40 (questions 147-150). |
| SNC-V4-003 | `SNC-003/1` | `IN_REVIEW` | B | `INTERMEDIATE` | `PEBC-NAPRA-2026-2.2` / `SNC-PHARMACOCINETIQUE-BHE` | p. 4 (« Barrière hémato-encéphalique ») et p. 48-49 (questions 197-198). |
| SNC-V4-004 | `SNC-004/1` | `IN_REVIEW` | D | `ADVANCED` | `PEBC-NAPRA-2026-1.4` / `SNC-OPIOIDES-SECURITE` | p. 12 (dépression respiratoire) et p. 18 (signes classiques et « si respiration ralentie : urgence »). |
| SNC-V4-005 | `SNC-005/1` | `IN_REVIEW` | B | `INTERMEDIATE` | `PEBC-NAPRA-2026-1.2` / `SNC-ANTIPSYCHOTIQUES` | p. 18-19, questions 42-48. |
| SNC-V4-006 | `SNC-006/1` | `IN_REVIEW` | C | `INTERMEDIATE` | `PEBC-NAPRA-2026-1.4` / `SNC-ANTIDEPRESSEURS-ISRS` | p. 23-24, questions 63-67 et 69. |
| SNC-V4-007 | `SNC-007/1` | `IN_REVIEW` | C | `ADVANCED` | `PEBC-NAPRA-2026-1.2` / `SNC-ANTIDEPRESSEURS-TRICYCLIQUES` | p. 27, question 80. |
| SNC-V4-008 | `SNC-008/1` | `IN_REVIEW` | D | `INTERMEDIATE` | `PEBC-NAPRA-2026-2.2` / `SNC-PARKINSON` | p. 36, questions 124-128. |
| SNC-V4-009 | `SNC-009/1` | `IN_REVIEW` | B | `INTERMEDIATE` | `PEBC-NAPRA-2026-1.4` / `SNC-ANTIEPILEPTIQUES` | p. 46, questions 181-183. |
| SNC-V4-010 | `SNC-010/1` | `IN_REVIEW` | C | `INTERMEDIATE` | `PEBC-NAPRA-2026-2.2` / `SNC-ALZHEIMER` | p. 47-48, questions 185-195. |

## Correspondance des champs persistés

| V4 | MCQ_CORPUS/1 | Traitement |
|---|---|---|
| Identifiant de l'item V4 | `itemId` | Normalisé en identifiant stable `SNC-xxx`; la version documentaire n'est pas incorporée à l'identité. |
| Dossier V4 | `corpusVersion` | Valeur 4. |
| Statut éditorial DRAFT/revue | `status` | `IN_REVIEW`; bloque la sélection dans une nouvelle session. |
| Stem | `stem` | Repris sans modification clinique. |
| Options A-D | `choices` | Quatre choix, texte inchangé. |
| Bonne réponse | `correctChoiceId` | Lettre A-D inchangée. |
| Justification de la clé | `explanation` | Reprise comme explication post-soumission. |
| Difficulté | `difficulty` | Reprise exactement. |
| SourceVersion proposée | `source.sourceVersionId` | Reprise exactement : `SNC-COURS-2026-04-28/V1`. |
| Source/page | `source.reference` | `type: PAGE`; texte complet conservé dans `locator` et `label`. |
| Mapping PEBC/NAPRA | `mappings[].competencyId` | Identifiant opaque préfixé `PEBC-NAPRA-2026-`. |
| Domaine du mapping | `mappings[].domainId` | `PEBC-2026-CLINICAL-CARE` ou `PEBC-2026-KNOWLEDGE-EXPERTISE`, selon la compétence V4. |
| Thème SNC | `mappings[].topicId` | Identifiant thématique opaque stable, détaillé dans le tableau ci-dessus. |
| Objectif d'apprentissage | `mappings[].objectiveIds` | Identifiant stable `SNC-xxx-OA-01`; le libellé complet reste dans V4. |

## Champs éditoriaux non persistés par le contrat actuel

Les informations suivantes restent intégralement dans `docs/content/SNC-QCM-PILOT-V4.md` et ne sont ni supprimées ni incorporées artificiellement au stem :

- type d'item (`STANDALONE` / cas);
- niveau cognitif;
- libellé complet de l'objectif d'apprentissage;
- libellé humain complet du thème;
- description textuelle de la compétence visée;
- justification individuelle de chaque distracteur;
- références cliniques externes de validation;
- risque d'obsolescence;
- `READY_FOR_HUMAN_REVIEW`;
- `DOCUMENTARY_CLINICAL_VALIDATION`;
- `EDITORIAL_REVIEW`;
- `INDEPENDENT_PHARMACIST_REVIEW: NOT_PERFORMED`;
- `SAFETY_REVIEW`;
- changelog V3 vers V4 et contrôle documentaire;
- identité/date d'un éventuel réviseur et historique détaillé des décisions éditoriales.

MIG-0014 et `MCQ_CORPUS/1` ne disposent d'aucune colonne ni propriété pour ces champs. Leur source de vérité reste le dossier éditorial versionné. Aucun contournement de schéma n'est utilisé.

## Conditions avant une future autorisation d'import

1. La revue éditoriale finale doit être explicitement approuvée.
2. `SAFETY_REVIEW` doit valoir `NO_UNRESOLVED_ISSUE`.
3. Une nouvelle projection devra alors créer une nouvelle version immuable avec un statut `PUBLISHED`; le présent JSON `IN_REVIEW` ne doit pas être modifié silencieusement après import.
4. La `source_versions` `SNC-COURS-2026-04-28/V1` doit exister dans la base cible.
5. La base cible doit être en version 14.
6. Une autorisation séparée est requise avant toute exécution avec `--apply`.

## Dry-run demandé

Commande d'exploitation prévue, sans `--apply` :

```powershell
pnpm.cmd run mcq:import -- --database=C:\Users\otcho\AppData\Local\Temp\mentor-mcq-dry-run\mentor.db --corpus=C:\Users\otcho\Documents\MENTOR PLATEFORME\docs\content\SNC-QCM-PILOT-V4.mcq-corpus.json
```

Le mode sans `--apply` lit et valide uniquement le JSON. Le code d'exploitation ne construit pas `DatabaseSync` dans cette branche et n'ouvre donc pas le chemin de base fourni.

Le lanceur local `tsx` n'a pas pu atteindre le script dans cet environnement Windows : il échoue dans sa propre initialisation avec `uv_os_get_passwd / ENOMEM`, avant toute lecture du corpus. Ce défaut du lanceur n'a créé ni ouvert aucune base.

La validation a donc été exécutée directement avec le même contrat applicatif `parseMcqCorpus()` utilisé par `scripts/import-mcq-corpus.ts`, sans `--apply`, sans importer le writer SQLite et sans ouvrir de base. Résultat exact :

```json
{"status":"VALIDATED_NOT_IMPORTED","schemaVersion":"MCQ_CORPUS/1","corpusId":"SNC-QCM-PILOT","corpusVersion":4,"itemCount":10}
```

- Code de sortie : `0`.
- Base synthétique présente avant validation : `NON`.
- Base synthétique présente après validation : `NON`.
- SQLite ouverte : `NON`.
- Import exécuté : `NON`.

## Verdict

- Dix items projetés.
- Quatre choix A-D et une clé unique par item.
- Contenu clinique repris sans modification.
- Tous les items restent `IN_REVIEW`.
- Revue pharmacien : `NOT_PERFORMED`, facultative/recommandée.
- Import réel : non autorisé et non exécuté.

# Publication du corpus pilote SNC V4

## Relation documentaire et technique

- Dossier clinique et éditorial de référence : `docs/content/SNC-QCM-PILOT-V4.md`.
- Projection importable revue : `docs/content/SNC-QCM-PILOT-V4.mcq-corpus.json`, `corpusVersion: 4`, items `version: 1`, statut `IN_REVIEW`.
- Décision éditoriale et sécurité : `docs/content/SNC-QCM-PILOT-V4-EDITORIAL-SAFETY-REVIEW.md`, 10/10 items approuvés et 10/10 sans problème de sécurité non résolu.
- Projection publiée immuable : `docs/content/SNC-QCM-PILOT-V4-PUBLISHED.mcq-corpus.json`, `corpusVersion: 5`, items `version: 2`, statut `PUBLISHED`.

La projection publiée conserve les identités stables `SNC-001` à `SNC-010`. Les stems, options, clés, explications, difficultés et mappings sont identiques à la projection `IN_REVIEW`. Seuls les champs nécessaires à la publication versionnée changent : `corpusVersion`, `items[].version`, `items[].status` et `items[].source.sourceVersionId`.

## Résolution de la source

- Alias éditorial : `SNC-COURS-2026-04-28/V1`.
- Véritable clé étrangère `sourceVersionId` : `8fdf1a28-6025-4846-a74b-1b4faca1d98f`.
- État vérifié en lecture seule : source `READY`, extraction `COMPLETED`, version source `1`, base de schéma `15`.

L'alias sert uniquement à la traçabilité éditoriale de ce document. Il n'est jamais utilisé comme FK dans le corpus publié : le JSON contient exclusivement l'UUID réel.

## Règles d'immuabilité

- Le JSON `IN_REVIEW` n'est ni modifié ni écrasé.
- La publication crée une nouvelle version d'item (`2`) au lieu de muter la version `1`.
- Une correction ultérieure devra créer une version d'item strictement supérieure et un nouveau `corpusVersion`.
- Aucun item n'est importé par la création de ces fichiers; l'import réel demeure une opération distincte avec autorisation explicite et `--apply`.
- `INDEPENDENT_PHARMACIST_REVIEW` reste tracée comme `NOT_PERFORMED` dans le dossier éditorial; ce champ n'est pas accepté par le contrat `MCQ_CORPUS/1` et n'est pas compressé dans le stem.

## Contrôles attendus avant import réel

1. Validation stricte `MCQ_CORPUS/1`.
2. Présence de dix items exactement et des identités `SNC-001` à `SNC-010`.
3. Correspondance exacte des dix clés et de tout le contenu clinique avec la projection V4 `IN_REVIEW`.
4. Résolution de l'alias vers l'UUID ci-dessus et disponibilité de la source.
5. Dry-run de `scripts/import-mcq-corpus.ts` sans `--apply`.

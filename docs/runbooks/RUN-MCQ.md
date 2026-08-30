# RUN-MCQ — Diagnostiquer le MCQ Core

1. Relever le `traceId`, le `sessionId`, l'heure et l'action, sans copier l'énoncé ni le texte de réponse.
2. Filtrer les événements structurés `mcq.session.*`, `mcq.items.selected`, `mcq.answer.*` avec le même `traceId`.
3. Vérifier la version DB attendue (6) et l'historique MIG-0006. Ne jamais migrer une base réelle implicitement.
4. Pour `MCQ_SELECTION_IMPOSSIBLE`, vérifier blueprint, difficultés, nombre demandé et contraintes de couverture.
5. Pour `MCQ_ITEM_VERSION_MISSING`, vérifier que le snapshot référence une version persistée et immuable.
6. Pour `MCQ_ANSWER_DUPLICATE`, ne pas réessayer automatiquement : la soumission n'est pas idempotente.
7. Pour `MCQ_SESSION_ALREADY_COMPLETED`, lire l'historique; ne pas rouvrir la session par SQL manuel.
8. Pour un échec DB, préserver la cause et la sauvegarde. Restaurer uniquement vers staging selon la procédure contrôlée.
9. Reproduire avec les fixtures synthétiques `src/test/fixtures/mcq-items.ts`, puis exécuter les tests domaine, application, repository et routes.

Échecs fréquents : corpus conforme insuffisant, contrainte impossible, version supprimée/incohérente, réponse répétée, session déjà close ou migration non activée.
# Exploitation MCQ

## Import contrôlé d'un corpus

1. Valider le JSON sans ouvrir la base :

   `pnpm.cmd run mcq:import -- --database=C:\chemin\absolu\mentor.db --corpus=C:\chemin\absolu\corpus.json`

2. Vérifier séparément que la base cible est en version 14 et que la source référencée existe.
3. Obtenir l'autorisation opérateur pour la base et le corpus précis.
4. Exécuter une seule fois avec `--apply`.
5. Contrôler le résultat `IMPORTED` et ouvrir une session MCQ synthétique/ciblée.

La commande n'active aucune migration. Elle n'accepte que des chemins absolus et ne doit jamais être exécutée au démarrage de l'application.

## Arrêts et erreurs stables

- `MCQ_IMPORT_ABSOLUTE_PATHS_REQUIRED` : utiliser deux chemins absolus.
- `MCQ_IMPORT_SCHEMA_VERSION_REQUIRED:14` : préparer séparément l'activation contrôlée de MIG-0014 ; ne pas contourner.
- `MCQ_SOURCE_VERSION_NOT_FOUND` : importer ou référencer une version documentaire validée.
- `MCQ_ITEM_VERSION_CONFLICT` : une version immuable existe avec un contenu différent ; créer la version suivante.
- `MCQ_ITEM_VERSION_GAP` : importer exactement la version suivant la dernière version connue.

Ne jamais convertir automatiquement les questions legacy, activer les données de démonstration ou générer du contenu clinique depuis les documents.

## Contrôle éditorial avant import d'un item PUBLISHED

- Exiger `DOCUMENTARY_CLINICAL_VALIDATION` et refuser `CONTRADICTED`, `OUTDATED` ou `INSUFFICIENT_EVIDENCE`.
- Exiger `EDITORIAL_REVIEW: APPROVED`.
- Exiger `SAFETY_REVIEW: NO_UNRESOLVED_ISSUE`; tout problème de sécurité non résolu bloque la publication et l'import comme `PUBLISHED`.
- Recommander `INDEPENDENT_PHARMACIST_REVIEW`, sans la rendre obligatoire.
- Si elle n'a pas eu lieu, conserver explicitement `INDEPENDENT_PHARMACIST_REVIEW: NOT_PERFORMED` dans le dossier éditorial versionné.
- Ne pas inventer cette métadonnée dans SQLite : le contrat `MCQ_CORPUS/1` et MIG-0014 ne la persistent pas encore.

# ADR-0005 — Items MCQ versionnés et mappings blueprint opaques

Statut : accepté pour le Lot 5.

## Décision

Une tentative référence toujours la paire immuable `itemId/version` stockée dans le snapshot de session. Modifier un item produit une nouvelle version; le repository MCQ ne met pas à jour une version existante. Ainsi, une correction historique reste interprétable même après évolution du contenu.

Les mappings `blueprintVersionId`, `domainId`, `competencyId`, `topicId` et `objectiveIds` sont obligatoires mais opaques. Le MCQ les valide, les sélectionne et les agrège sans posséder le catalogue Blueprint. Cette frontière évite de reconstruire le Lot 1 ou de figer les pondérations PEBC dans le moteur.

Les tables legacy `questions` et `attempts` ne sont pas converties. Leur champ `subject` ne permet pas de déduire honnêtement domaine, compétence et objectif. Une conversion automatique fabriquerait une information pédagogique. Elles restent préservées et séparées.

## Conséquences

MIG-0006 ajoute des tables `mcq_*`, des FK et un snapshot ordonné. Les items conformes peuvent être chargés par un futur flux de contenu. Item Quality, publication et reviewer queue restent Lot 6; Learner Model et remédiation restent Lot 7.

## Récupération

La migration est forward-only. Une base réelle doit passer par l'activation contrôlée avec sauvegarde vérifiée. En cas d'échec, aucune restauration automatique de la base active; utiliser la sauvegarde pour une restauration vers staging et une décision humaine.

## Dette technique

`TECH-DEBT-MIG-REGISTRY` — `coreMigrationRegistry` est actuellement colocé avec la définition de MIG-0001 dans `mig-0001-core-baseline.ts`. Le Lot 5 conserve cette convention établie et y ajoute uniquement MIG-0006 au registre global. Le registre devra être extrait dans un fichier dédié lors d'un refactor contrôlé futur, sans modifier les définitions ni checksums des migrations historiques.

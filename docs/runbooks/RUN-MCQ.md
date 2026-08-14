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

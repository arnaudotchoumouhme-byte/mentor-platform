# Module MCQ Core

Le MCQ Core fournit un domaine indépendant de React, Next.js et SQLite pour les items versionnés, la sélection, les sessions, les réponses et le scoring. Il n'utilise ni Internet, ni LLM.

## Modèle

- `QuestionItemVersion` associe un `itemId` stable à une version immuable, des choix identifiés, une clé, une explication et au moins un mapping pédagogique.
- Les références `blueprintVersionId`, `domainId`, `competencyId`, `topicId` et `objectiveIds` sont opaques et obligatoires. Le module ne définit pas de catalogue PEBC et ne code aucune pondération officielle.
- `McqSession` conserve le snapshot ordonné exact `itemId/version`. Une réponse ne peut être enregistrée qu'une fois et seulement tant que la session est ouverte.
- Le résultat conserve total, answered, correct, incorrect, unanswered, pourcentage et agrégations domaine/compétence/topic.

## API

- `POST /api/mcq/sessions` crée une session `STUDY` ou `QUIZ` avec seed et contraintes.
- `GET /api/mcq/sessions/{sessionId}` lit session, historique et score éventuel.
- `POST /api/mcq/sessions/{sessionId}/answers` corrige et persiste une réponse.
- `POST /api/mcq/sessions/{sessionId}/complete` clôture et persiste le score.

Toutes les entrées HTTP sont validées par Zod. Les routes ne contiennent ni SQL ni calcul métier. Les événements `mcq.*` propagent le `traceId` et n'enregistrent pas le texte intégral des réponses.

## Persistance et compatibilité

MIG-0006 ajoute uniquement des tables `mcq_*`. Les tables historiques `questions` et `attempts` restent inchangées et ne sont pas converties, car elles ne possèdent pas de mapping blueprint fiable. Une base réelle version 5 exige une activation contrôlée distincte avant de pouvoir charger la composition serveur version 6.

## Limites volontaires

Le workflow reviewer/publication appartient au Lot 6. Le Learner Model, la remédiation et les re-tests ciblés appartiennent au Lot 7. Les mocks complets et readiness appartiennent au Lot 9. L'authentification/workspace n'existe pas encore dans le MVP local mono-utilisateur.

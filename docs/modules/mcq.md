# Module MCQ Core

Le MCQ Core fournit un domaine indépendant de React, Next.js et SQLite pour les items versionnés, la sélection, les sessions, les réponses et le scoring. Il n'utilise ni Internet, ni LLM.

## Modèle

- `QuestionItemVersion` associe un `itemId` stable à une version immuable, des choix identifiés, une clé, une explication et au moins un mapping pédagogique.
- Les références `blueprintVersionId`, `domainId`, `competencyId`, `topicId` et `objectiveIds` sont opaques et obligatoires. Le module ne définit pas de catalogue PEBC et ne code aucune pondération officielle.
- `McqSession` conserve le snapshot ordonné exact `itemId/version`. Une réponse ne peut être enregistrée qu'une fois et seulement tant que la session est ouverte.
- Le résultat conserve total, answered, correct, incorrect, unanswered, pourcentage et agrégations domaine/compétence/topic.

## API

- `GET /api/mcq/sessions` liste les blueprints publiés ayant des items jouables.
- `POST /api/mcq/sessions` crée une session `STUDY` ou `QUIZ` avec seed et contraintes.
- `GET /api/mcq/sessions/{sessionId}` lit session, historique et score éventuel.
- `POST /api/mcq/sessions/{sessionId}/answers` corrige et persiste une réponse.

Avant la soumission, la projection jouable ne contient que l'énoncé, les choix et la difficulté. La bonne réponse et l'explication ne sont retournées qu'après l'enregistrement de la réponse.

## Corpus versionné

Le contrat d'échange est `docs/schemas/mcq-corpus-v1.schema.json`. L'import valide strictement le document, exige une `source_version` existante, écrit toutes les versions dans une transaction et refuse toute réécriture d'une version existante. Réimporter un contenu strictement identique est idempotent.

MIG-0014 ajoute uniquement les métadonnées éditoriales, la version de source et la référence documentaire structurée. Seuls les items `PUBLISHED` peuvent être sélectionnés. Aucun import, seed ou changement éditorial n'est exécuté au démarrage.

La décision de publication distingue trois contrôles : `DOCUMENTARY_CLINICAL_VALIDATION` obligatoire, `EDITORIAL_REVIEW` obligatoire et `INDEPENDENT_PHARMACIST_REVIEW` facultative/recommandée. Une publication sans revue pharmacien conserve explicitement `INDEPENDENT_PHARMACIST_REVIEW: NOT_PERFORMED`. Les conclusions documentaires `CONTRADICTED`, `OUTDATED` ou `INSUFFICIENT_EVIDENCE`, ainsi que tout problème de sécurité non résolu, bloquent `PUBLISHED`. Ces décisions restent dans le dossier éditorial versionné tant que le contrat d'import et la persistance ne les prennent pas explicitement en charge.

La commande d'exploitation est volontairement explicite :

```powershell
pnpm.cmd run mcq:import -- --database=C:\chemin\absolu\mentor.db --corpus=C:\chemin\absolu\corpus.json
```

Sans `--apply`, elle valide uniquement le corpus et n'ouvre pas SQLite. L'écriture exige `--apply` et une base déjà migrée en version 14. L'activation de MIG-0014 et l'import d'un corpus réel sont deux opérations séparées soumises à autorisation.
- `POST /api/mcq/sessions/{sessionId}/complete` clôture et persiste le score.

Toutes les entrées HTTP sont validées par Zod. Les routes ne contiennent ni SQL ni calcul métier. Les événements `mcq.*` propagent le `traceId` et n'enregistrent pas le texte intégral des réponses.

## Persistance et compatibilité

MIG-0006 ajoute uniquement des tables `mcq_*`. Les tables historiques `questions` et `attempts` restent inchangées et ne sont pas converties, car elles ne possèdent pas de mapping blueprint fiable. Une base réelle version 5 exige une activation contrôlée distincte avant de pouvoir charger la composition serveur version 6.

## Limites volontaires

Le workflow reviewer/publication appartient au Lot 6. Le Learner Model, la remédiation et les re-tests ciblés appartiennent au Lot 7. Les mocks complets et readiness appartiennent au Lot 9. L'authentification/workspace n'existe pas encore dans le MVP local mono-utilisateur.

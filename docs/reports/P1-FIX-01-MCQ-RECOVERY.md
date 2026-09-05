# P1-FIX-01 — Récupération sûre des mutations MCQ incertaines

## Objectif et périmètre

Corriger le finding `UNCERTAIN_HTTP_MUTATION_RECOVERY` sans étendre le périmètre fonctionnel : lorsqu'une réponse HTTP de création, réponse ou finalisation MCQ est perdue ou incertaine, le client réconcilie d'abord l'état serveur avant d'autoriser une nouvelle mutation.

Branche : `codex/p1-autonomous`
HEAD de départ : `1adc614348023dcb99a59727079a92c8e58d130b`

## Cause racine

Le runner protégeait les doubles clics synchrones, mais une erreur réseau ou une réponse HTTP 409/5xx après application effective de la mutation laissait le client sans preuve du résultat. Une relance directe pouvait alors créer une seconde session ou soumettre une seconde réponse.

## Solution minimale

- La création reçoit un UUID de session généré côté client et validé par la route. En cas de résultat incertain, un `GET` de cette session est effectué avant toute nouvelle création.
- Si la session existe, son état serveur est repris sans second `POST`. Si un `404` confirme son absence, une relance explicite réutilise exactement le même UUID.
- Après une réponse ou une finalisation incertaine, le runner recharge la session possédée. Une réponse déjà enregistrée est reprise avec sa correction; une réponse absente autorise une relance explicite.
- Les 401/403/404 déterministes provoquent une sortie sûre. Les 409, 5xx et erreurs réseau déclenchent une réconciliation.
- Si la réconciliation échoue, le runner reste fermé aux nouvelles mutations et propose un retour au tableau de bord.
- Le signal serveur `retriable` est respecté pour le catalogue.

Cette correction ne crée pas un mécanisme général de reprise de session et ne modifie ni le schéma ni le modèle de persistance.

## Fichiers fonctionnels et tests

- `src/application/mcq/create-mcq-session.ts` — accepte l'identifiant optionnel validé de réconciliation.
- `src/app/api/mcq/sessions/route.ts` — valide l'UUID optionnel et conserve l'association d'ownership existante.
- `src/components/mcq-session-runner.tsx` — réconciliation, relances explicites et sorties sûres.
- `src/application/mcq/create-mcq-session.test.ts` — identifiant fourni par l'appelant.
- `src/app/api/mcq/sessions/mcq-route-contract.test.ts` — validation et ownership de la création.
- `src/components/mcq-session-runner.test.ts` — scénarios d'incertitude et garde-fous UI.

## Scénarios validés

- Flux normal, quatre choix, aucune clé avant soumission, correction après soumission.
- Réponse de création perdue après création effective : récupération sans second `POST`.
- Création réellement absente : relance explicite avec le même UUID.
- Réponse perdue après enregistrement : état et correction récupérés sans seconde soumission.
- Réponse réellement absente : relance explicite seulement après confirmation serveur.
- Conflit 409 : réconciliation et absence de relance aveugle.
- 403 et 404 catalogue : sortie sûre sans retry aveugle.
- Échec de réconciliation : verrouillage fail-closed.
- Double clic : un seul appel de mutation.
- Catalogue vide : état terminal explicite.

## Quality gates exécutés

- Tests ciblés : `20/20` réussis, `3/3` fichiers.
- TypeScript complet : réussi.
- ESLint complet : réussi.
- Tests globaux : `604/604` réussis, `129/129` fichiers.
- Build Next.js production simulant Render : réussi, `22/22` pages.
- Preuve build sans DB : `BUILD_DATA_EXISTS=False`.
- `git diff --check` : réussi.
- Recherche ciblée de secrets dans le diff : aucun secret détecté.

## Sécurité et invariants

- L'ownership reste vérifié côté serveur avant lecture, réponse et finalisation.
- La correction et la clé restent absentes de la projection avant réponse.
- Aucune migration créée ou modifiée.
- `data/mentor.db` et toute base réelle n'ont pas été ouvertes ni modifiées.
- Aucun contenu clinique SNC, Auth0, Render ou infrastructure n'a été modifié.
- Aucun push, merge, rebase ou déploiement n'a été effectué.

## Limites et risques résiduels

- La réconciliation repose sur un UUID connu du client et sur la route d'ownership existante; elle ne remplace pas une infrastructure distribuée d'idempotency keys.
- Si la session est créée mais que son association d'ownership échoue, la récupération est refusée et reste fail-closed; aucune seconde session n'est créée automatiquement.
- Une panne persistante empêchant le `GET` de réconciliation exige un retour au tableau de bord et une intervention ultérieure, plutôt qu'une mutation aveugle.

## Verdict

Le finding original est résolu. La tranche est validable pour re-revue P1, mais n'autorise ni push, ni merge, ni déploiement sans validation humaine séparée.

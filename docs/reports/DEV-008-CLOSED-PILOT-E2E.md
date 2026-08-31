# DEV-008 — Closed Pilot E2E

## Objectif et niveau de preuve

Valider le parcours fermé Auth boundary → provisioning → dashboard → catalogue SNC → session → soumission → correction → progression/reprise → isolation. Niveau utilisé : intégration routes/services/composants, faute de harness navigateur existant. Aucun tenant Auth0 externe ni Render distant n'a été utilisé.

## Scénario contrôlé

Le parcours principal a été exécuté sur une copie temporaire de la staging v16 autorisée. Deux comptes et identités synthétiques A/B ont été provisionnés via `PilotProvisioningService`. Le test éphémère a été supprimé après succès ; la staging source est restée inchangée.

- identité absente : `UNAUTHORIZED` ; identité non provisionnée : `PILOT_ACCESS_DENIED` ; A et B provisionnés : résolution `subject → account → learner` réussie ;
- catalogue : `PEBC-PART-I-2026`, 10 items SNC courants, tous en version 2 ; aucune clé, correction ou explication dans le catalogue ;
- session A : création réussie, ownership A enregistré, deux questions et quatre options par question ;
- avant soumission : aucune propriété `correctChoiceId` ou `explanation` sérialisée ;
- soumission volontairement incorrecte : correction, bonne option et explication retournées après soumission ; une seule réponse persistée ;
- question suivante : quatre options, sans clé ni explication avant réponse ;
- reprise A : progression conservée ;
- B connaissant le sessionId de A : GET et POST answer refusés 403 avant le cas d'usage ; aucune session/progression B créée ;
- A conserve l'accès après les tentatives B.

## Dashboard et états terminaux

Les tests existants confirment la projection dashboard, les états interface, la sortie de loading sur 403, 404 et erreur réseau, ainsi que les erreurs API contrôlées. Aucun chargement infini n'a été observé.

## Validation

- E2E staging temporaire : 1/1 test réussi.
- Régression P0 finale : 11 fichiers, 35/35 tests réussis.
- Total DEV-008 : 12 fichiers de tests exécutés, 36/36 tests réussis.
- Typecheck, lint et build : non requis, aucun fichier de production n'a été modifié.
- `data/mentor.db` non ouverte ; aucune migration, aucun changement SNC, aucun commit/push/deploy.

## Limites et conclusion

`AUTH0 LIVE LOGIN` n'a pas été exécuté : dépendance externe volontairement exclue. Aucun framework navigateur n'est installé ; `BROWSER E2E` est donc non exécuté, conformément à la stratégie autorisée. Les contrats serveur, routes, repositories et composants couvrent néanmoins tout le parcours P0.

DEV-001 à DEV-007 étaient déjà PASS. DEV-008 est **PASS** et la clôture P0 est **PASS**.

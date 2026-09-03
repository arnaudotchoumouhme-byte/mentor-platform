# P1/P2 Parallel Autonomous 01

## Objectif et périmètre

Mission locale d'amélioration autonome à faible risque sur les surfaces apprenant déjà existantes. Le travail a été limité à trois défauts d'interaction asynchrone démontrables : recherche documentaire, import depuis la Bibliothèque et sauvegarde des paramètres. Aucun comportement métier, schéma, contenu clinique, mécanisme Auth0/Render ou flux de migration n'a été modifié.

Branche : `codex/p1-autonomous`

Base de comparaison : `main` à `f506a17dc8a48213a42efdfc3bfb783e0fc2b182`

HEAD au début : `8f3a9819ae0268fe1cf38e8f634d2044869b4c00`

Commit fonctionnel créé : `d98f2a7 fix(ui): harden learner async interactions`

## Candidats examinés

| Candidat | Valeur / risque | Décision |
| --- | --- | --- |
| Recherche : erreur HTTP/réseau masquée et doubles requêtes | Élevée / faible | Implémenté |
| Bibliothèque : échec affiché comme succès, absence de verrou d'import | Élevée / faible | Implémenté |
| Paramètres : rejet non affiché et doubles sauvegardes | Élevée / faible | Implémenté |
| Coach IA : remontée locale des erreurs d'action | Moyenne / moyenne | Différé ; demande un contrat UX cohérent avec les quotas IA |
| Examen blanc : dépendance au jeu legacy vide | Élevée / élevée | Différé ; décision produit et convergence MCQ Core nécessaires |
| Progression : enrichissement des états vides | Faible / faible | Différé ; moins prioritaire que les erreurs terminales |
| Reprise de session MCQ P1-05 | Élevée / moyenne | Note de décision ci-dessous ; aucune implémentation sans arbitrage produit |
| Généralisation d'un composant d'erreur partagé | Moyenne / moyenne | Écarté ; abstraction prématurée pour trois flux localisés |

Question de simplicité : « Cette solution pourrait-elle être plus simple tout en restant fiable, compréhensible, testable et évolutive ? »

Verdict : non. Les états et verrous restent locaux à chaque interaction, réutilisent `clientFetch`, `Notice` et `useAppState`, et n'ajoutent ni dépendance ni framework interne.

## Fichiers créés ou modifiés

Fichiers suivis modifiés :

- `src/app/search/page.tsx`
- `src/app/library/page.tsx`
- `src/app/settings/page.tsx`

Fichiers créés :

- `src/app/search/page.test.ts`
- `src/app/library/page.test.ts`
- `src/app/settings/page.test.ts`
- `docs/reports/P1P2-PARALLEL-AUTONOMOUS-01.md`

Aucun fichier supprimé.

## Fonctionnalités réalisées

- Recherche : erreur HTTP ou réseau terminale visible, référence `traceId` lorsqu'elle est disponible, expiration distinguée, contrôles désactivés pendant la requête et double soumission bloquée.
- Bibliothèque : succès et échec visuellement distingués, erreur traçable, expiration/réseau gérés, double import bloqué et champ fichier réinitialisé après chaque tentative.
- Paramètres : confirmation non persistante après une nouvelle modification, échec terminal explicite et sûr, bouton restauré après erreur et doubles sauvegardes bloquées.
- Les résultats ou données déjà affichés sont conservés en cas d'échec ; aucune page ne reste dans un état d'attente après une erreur terminale de ces opérations.

## Décisions techniques

- Verrou synchrone par `useRef` en complément de l'état visuel React afin de couvrir deux événements survenant avant le prochain rendu.
- Réutilisation de `ClientRequestError` pour distinguer expiration et indisponibilité réseau.
- Aucun détail d'exception brute n'est rendu à l'utilisateur.
- Aucun changement du contrat public de `clientFetch`, `useAppState` ou des routes API.
- Aucun nouvel accès à SQLite et aucun effet au build ou au démarrage.

## Note de décision P1-05 — reprise de session MCQ

### Comportement actuel

Une session est créée explicitement par l'apprenant. Le runner connaît la session courante durant son cycle de vie, mais l'expérience ne propose pas encore de sélection/reprise persistante après rechargement ou navigation.

### Questions ouvertes

- Reprise automatique ou action explicite « Reprendre » ?
- Politique d'abandon et d'expiration d'une session incomplète ?
- Priorité en présence de plusieurs sessions `IN_PROGRESS` ?
- Effet d'une nouvelle version publiée du corpus sur une session existante ?
- Place des sessions terminées dans l'historique apprenant ?

### Options produit

1. Reprise automatique de la dernière session : friction minimale, mais changement de contexte implicite et ambiguïtés en cas de sessions multiples.
2. Reprise explicite de la session la plus récente : comportement clair, testable et compatible avec un abandon explicite.
3. Liste complète des sessions : plus flexible, mais ajoute une surface de gestion non justifiée pour le pilote.

### Risques

Une règle implicite pourrait rouvrir une session obsolète, masquer des sessions concurrentes ou créer une attente erronée sur le versioning du corpus. L'abandon sans règle explicite peut également altérer l'interprétation des statistiques.

### Recommandation minimale

Retenir l'option 2 : une action visible « Reprendre » pour l'unique session `IN_PROGRESS` la plus récente, accompagnée d'un abandon explicite et de règles décidées d'expiration/versioning. Décision humaine requise avant implémentation.

## Migrations et état des données

- Migration concernée : aucune.
- `data/mentor.db` : ni ouverte, ni interrogée, ni modifiée.
- Les commandes de test ont utilisé `MENTOR_ENABLE_DEMO_DATA=0` et un `MENTOR_DATA_DIRECTORY` temporaire sous `%TEMP%`.
- Aucun seed, import, bootstrap ou migration réelle exécuté.

## Contrôles exécutés

| Commande | Résultat exact |
| --- | --- |
| `pnpm.cmd exec vitest run src/app/search/page.test.ts src/app/library/page.test.ts src/app/settings/page.test.ts` | Suspendue sans sortie ; interrompue, aucune écriture métier |
| `.\\node_modules\\.bin\\vitest.cmd run src/app/search/page.test.ts src/app/library/page.test.ts src/app/settings/page.test.ts --maxWorkers=1 --minWorkers=1` | Échec de syntaxe : option Vitest `--minWorkers` inconnue ; aucun test lancé |
| `.\\node_modules\\.bin\\vitest.cmd run src/app/search/page.test.ts src/app/library/page.test.ts src/app/settings/page.test.ts --maxWorkers=1` | Première passe : 6/9, trois assertions utilisaient un matcher non configuré ; correction des tests uniquement. Passe finale : 3 fichiers, 9/9 tests réussis |
| `pnpm.cmd run typecheck; pnpm.cmd run lint; git diff --check` | Lanceur suspendu sans sortie ; interrompu |
| `.\\node_modules\\.bin\\tsc.cmd --noEmit` | Réussi, code 0 |
| `.\\node_modules\\.bin\\eslint.cmd .` | Réussi, code 0, aucun avertissement affiché |
| `.\\node_modules\\.bin\\vitest.cmd run --maxWorkers=1` | 132 fichiers réussis, 613/613 tests réussis |
| `.\\node_modules\\.bin\\next.cmd build` | Réussi ; compilation, TypeScript et génération de 22/22 pages réussies |
| `git diff --check` | Réussi avant commit fonctionnel ; aucune anomalie d'espacement |

Le recours direct aux exécutables verrouillés de `node_modules/.bin` contourne uniquement la suspension du lanceur `pnpm.cmd` observée dans cet environnement ; aucune dépendance n'a été installée ou modifiée.

## Problèmes rencontrés et résolution

- Le lanceur `pnpm.cmd` s'est suspendu sans sortie. Les binaires du lockfile déjà installés ont été utilisés directement.
- Vitest 4.1.10 ne reconnaît pas `--minWorkers`; la commande a été relancée avec le seul paramètre valide `--maxWorkers=1`.
- Le dépôt n'active pas les matchers `jest-dom`; trois assertions de test ont été remplacées par des contrôles standards de `textContent`. Aucun code fonctionnel n'a été changé pour résoudre ce point.

## Dette technique restante

- P1-05 reste une décision produit ouverte, documentée ci-dessus.
- Les erreurs locales pourraient être factorisées seulement si d'autres flux démontrent le même besoin ; aucune abstraction anticipée n'a été ajoutée.
- Le comportement du lanceur `pnpm.cmd` demeure un problème d'environnement/outillage déjà distinct du périmètre fonctionnel.

## Éléments volontairement exclus

- `.tmp-migration-runner/`
- `DOCS1/`
- `backups/`
- `content-sources/`
- `docs/reports/RAPPORT-ETAT-DEVELOPPEMENT.md`
- `dossier evolution/`
- `mentor-platform-restaure/`
- Toute base réelle, donnée utilisateur, opération Render ou Auth0.

## Actions non effectuées

- Aucun push, merge, rebase, déploiement ou opération Render.
- Aucune migration, ingestion, import MCQ ou modification de base réelle.
- Aucun changement de dépendance.
- Aucun démarrage du prochain lot ni implémentation de P1-05.

## Statut Git et verdict

Le commit fonctionnel `d98f2a7` contient six fichiers. Le présent rapport reste à committer séparément. Les sept groupes protégés préexistants restent non suivis et hors périmètre.

Verdict : **VALIDABLE**.

## Prochaine étape recommandée

Revue humaine du commit fonctionnel et de la note de décision P1-05, puis publication éventuelle de la branche dans une mission Git séparée.

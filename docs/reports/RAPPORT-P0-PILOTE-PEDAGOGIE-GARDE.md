# Phase courte P0 avant pilote

Date : 2026-09-15. Branche locale : `codex/pilot-p0-learning-guard`.
Base : `45dd9a6e23d4c0e15394e58728a16a1c46b73433`.
Modifications locales non commitées ; aucun push, merge ou déploiement.

## Corrections

- **PÉD-1** : dashboard et Flashcards partagent le filtre actif et dû. Une série conserve ses identifiants et son compteur ; une notation confirmée avance une seule fois, un échec permet de réessayer. Les doubles soumissions sont bloquées. « À revoir » conserve le comportement du scheduler existant et reste dû pour une nouvelle série explicitement demandée.
- **PÉD-2** : les indicateurs par matière utilisent les résultats des tentatives attribuées au learner, et non `subjects.mastery`. La moyenne descriptive est libellée « Résultat observé » ; sans tentative exploitable, « Non évalué ». Aucun nouveau score de maîtrise et aucune résolution automatique de weakness.
- **PÉD-3** : `/api/state` expose la disponibilité du catalogue QCM versionné et la reprise STANDARD issue du mécanisme existant de propriété des sessions. `actionCandidates` réutilise ces signaux. Le runner vérifie à nouveau l'identité et la session lors de la reprise. La banque legacy ne déclenche plus à elle seule une recommandation QCM.
- **PÉD-4** : la fin de séance présente le score réellement retourné, ou son indisponibilité ; accès à la correction par le GET existant de session, progression et accueil. Le démarrage d'une nouvelle séance est bloqué pendant le chargement de l'ancienne correction. Aucune correction anticipée pendant un examen actif.
- **SÉC-2** : Canadian Practice appelle `requirePilotIdentity` avant validation de la requête et chargement métier. Les comptes absents ou désactivés et l'absence de session sont refusés. Cette route sert un référentiel partagé, sans nouvelle donnée learner. La revue limitée des autres routes métier n'a pas entraîné d'autre modification ; les routes techniques de santé et les contrôles administratifs distincts restent en place.

## Fichiers

Production :

- `src/domain/flashcards/scheduling.ts`
- `src/app/flashcards/page.tsx`
- `src/app/progress/page.tsx`
- `src/presentation/dashboard/pebc-dashboard.ts`
- `src/hooks/use-state.ts`
- `src/app/api/state/route.ts`
- `src/components/mcq-session-runner.tsx`
- `src/app/api/canadian-practice/route.ts`

Tests :

- `src/app/flashcards/page.test.ts` (nouveau)
- `src/app/api/state/mcq-summary.test.ts` (nouveau)
- `src/app/progress/page.test.ts`
- `src/presentation/dashboard/pebc-dashboard.test.ts`
- `src/presentation/dashboard/pebc-interface.test.ts`
- `src/components/mcq-session-runner.test.ts`
- `src/app/api/canadian-practice/route.test.ts`
- `src/infrastructure/pilot/sqlite-pilot-ownership.integration.test.ts`

## Validations finales

- Tests ciblés : **93 réussis, 0 échoué**, 12 fichiers, 32,17 s ; code 0.
- Suite complète : `node node_modules/vitest/vitest.mjs run --maxWorkers=1`, **745 réussis, 1 ignoré, 0 échoué, aucun timeout**, 149 fichiers réussis, 289,00 s ; code 0.
- Typecheck : `node node_modules/typescript/bin/tsc --noEmit`, **PASS**, code 0.
- Lint : `node node_modules/eslint/bin/eslint.js .`, **PASS**, code 0.
- Build officiel : `pnpm run build`, **PASS**, code 0, compilation et génération des 22 pages terminées. Un avertissement réseau du mécanisme de vérification de mise à jour pnpm (`ERR_PNPM_META_FETCH_FAIL`) n'a pas interrompu le build ; aucune configuration n'a été changée pour le contourner.
- Diff : `git diff --check`, **PASS** ; périmètre des fichiers modifiés revu, sans modification de migration, schéma, dépendance ou configuration de déploiement. Les nouveaux fichiers de la mission sont également contrôlés pour les espaces en fin de ligne.

Les tests couvrent les cartes inactives/futures, plusieurs cartes, compteur, notation, échec, double clic, « À revoir » et état vide ; les résultats learner et l'absence de faux libellé de maîtrise ; le corpus versionné, son absence, la reprise appartenant au learner, les sessions terminées et d'autres learners ; la correction, le score absent, les destinations et l'examen actif ; les refus pilote et l'ordre identité puis chargement métier.
Les tests existants sont conservés. Les assertions fondées sur la maîtrise globale ont été remplacées par des assertions sur les résultats réellement observés, conformément à PÉD-2.

## Limites et périmètre préservé

- Vérification UI automatisée sous jsdom ; pas de nouvelle connexion Auth0 ni de vérification navigateur sur une base réelle pendant cette phase.
- La file Flashcards est conservée pendant la série dans le composant ; un rechargement complet recalcule les cartes dues. Le scheduler et les intervalles restent inchangés.
- La reprise proposée concerne les sessions STANDARD, avec les contrôles existants ; aucun moteur supplémentaire.
- La correction affiche uniquement les informations déjà exposées par l'API. Une question non répondue peut ne pas avoir de correction disponible.
- Les moyennes descriptives utilisent l'agrégation existante des tentatives ; cette phase ne crée pas une nouvelle agrégation globale des QCM STANDARD, ni une mesure de maîtrise.
- Aucune API de mutation ajoutée ou modifiée. Aucun nouveau modèle, table ou migration. MIG-0018 et MIG-0019 inchangées.
- Aucun accès à une base réelle ; tests synthétiques ou en mémoire uniquement. Aucune modification de `mentor.db`.
- Aucun secret ajouté ; aucune modification Auth0, Vercel, déploiement ou dépendances.
- Concepts MLE DRAFT et dix rattachements PROPOSÉS inchangés. Aucune publication clinique, session unique, MFA ou LOT 10.
- Les fichiers non suivis préexistants hors mission sont laissés intacts.

Rollback : retirer uniquement les changements de code et de tests de cette phase ; aucune opération de base de données nécessaire.

## Verdict

```text
PED_1_FLASHCARDS = PASS
PED_2_FACTUAL_PROGRESS = PASS
PED_3_NBA_QCM = PASS
PED_4_SESSION_END = PASS
CANADIAN_PRACTICE_GUARD = PASS
NEW_TABLE = NON
NEW_MIGRATION = NON
AUTH0_CHANGED = NON
VERCEL_CHANGED = NON
MLE_EDITORIAL_CHANGED = NON
TARGETED_TESTS = PASS
FULL_TESTS = PASS
TYPECHECK = PASS
LINT = PASS
BUILD = PASS
DIFF_CHECK = PASS
REAL_DB_TOUCHED = NON
SAFE_FOR_HUMAN_REVIEW = OUI
```

Arrêt après correction et validation locale. Aucun push, merge, déploiement ni LOT 10.

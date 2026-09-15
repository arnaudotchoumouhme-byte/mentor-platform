# Correction minimale — matière du plan d’étude

Branche : `codex/study-plan-free-subject`, créée depuis le commit P0 local validé `b15ebc9` (avant le commit de merge main).

Le formulaire utilisait exclusivement `subjects`, catalogue vide en production lorsque le seed démo est désactivé. Le champ est maintenant une saisie texte avec un `datalist` des matières existantes. Le libellé Matière est visible, le placeholder donne un exemple, et la première matière reste la valeur initiale lorsque le catalogue est rempli. Le payload `addTask.subject` reste une chaîne.

Fichiers : `src/app/study-plan/page.tsx`, `src/app/study-plan/page.test.ts`, ce rapport. Aucun changement API, DB, schéma, migration, seed, MLE ou configuration distante.

Validation effective :

- Tests ciblés : 3/3 PASS (catalogue vide, choix existant, texte libre avec catalogue ; payload et fermeture après soumission).
- Typecheck : PASS, code 0.
- Lint global : PASS, code 0.
- Build production : PASS, code 0. Le lanceur pnpm a affiché un avertissement réseau de recherche de mise à jour ; le build a terminé normalement.
- Suite globale exigée par les guardrails : lancée une fois avec `vitest run --maxWorkers=1`, puis interrompue après plusieurs minutes sans résultat au-delà de l’en-tête RUN. Code final 1 après interruption opérateur ; aucun décompte ni timeout de test confirmé. Gate NON VALIDÉ, aucune relance ou modification de test pour le contourner.
- Diff check : PASS.

Limite : disponibilité visuelle des suggestions dépend du navigateur natif (`datalist`). La saisie libre reste disponible. Aucun test navigateur en production ni écriture métier n’a été effectué.

SAFE_FOR_PREVIEW = NON : suite globale non validée. Aucun push, déploiement ou merge. Une intégration ultérieure devra aussi synchroniser la branche avec main avant push.

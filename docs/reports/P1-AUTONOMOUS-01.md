# P1 Autonomous 01

## Objectif et périmètre

Améliorations locales, réversibles et à faible risque de l’expérience pilote. Branche `codex/p1-autonomous`, créée depuis `main` à `f506a17dc8a48213a42efdfc3bfb783e0fc2b182`.

## Candidats examinés

- Expérience QCM : erreurs, double soumission, focus, progression et quatre options.
- États d’erreur partagés des pages pilote.
- Frontières API MCQ : identité, ownership, validation et protection de la correction.
- Contrats schema 16 et `MCQ_CORPUS/1`.

Les frontières API et contrats de version étaient déjà cohérents ; aucune modification n’y a été apportée.

## Travaux réalisés

1. **P1-01 — Résilience de la session QCM** (`VALUE: HIGH`, `RISK: LOW`)
   - verrou synchrone contre les doubles soumissions et complétions ;
   - erreur catalogue réessayable et retour non destructif après erreur d’action ;
   - progression exposée comme `progressbar` ;
   - choix annoncés A–D et focus déplacé sur le feedback après réponse.
2. **P1-02 — États d’erreur pilote actionnables** (`VALUE: HIGH`, `RISK: LOW`)
   - réseau, serveur et conflit offrent `Réessayer` ;
   - accès refusé offre une déconnexion sûre ;
   - preuve locale qu’aucun de ces états ne reste sur `Chargement`.
3. **P1-03 — Qualité de preuve UI** (`VALUE: MEDIUM`, `RISK: LOW`)
   - fixture QCM conforme aux quatre options ;
   - test anti-double soumission, focus feedback, progression, retry et sorties terminales.

## Fichiers

- `src/components/mcq-session-runner.tsx`
- `src/components/mcq-session-runner.test.ts`
- `src/components/ui.tsx`
- `src/components/ui.test.ts`
- `docs/reports/P1-AUTONOMOUS-01.md`

Aucun fichier de migration, contenu clinique, code Auth0, configuration Render ou donnée réelle n’a été modifié. Les sept groupes protégés sont restés hors périmètre.

## Vérifications

- Tests ciblés : 2 fichiers, 9/9 réussis.
- TypeScript complet : réussi (`tsc --noEmit`).
- ESLint complet : réussi (`eslint .`).
- Suite globale : 125/128 fichiers et 587/593 tests lors de la campagne concurrente. Les six échecs concernaient trois tests historiques sensibles au worker/timeout (`document-ingestion`, `local-document-storage`, `database-migration-preflight`). Revalidation mono-worker : 3/3 fichiers et 18/18 tests réussis.
- Build Next.js production simulé Render : réussi, 22/22 pages.
- Accès DB pendant build : aucun ; le chemin synthétique surveillé n’a pas été créé.
- Migration pendant build : aucune.
- `git diff --check` : réussi avant rapport ; contrôle final à effectuer après commit documentaire.

Le lanceur pnpm global a refusé sa vérification de signature hors réseau. Les binaires verrouillés de `node_modules/.bin` ont exécuté les contrôles sans installation ni modification de dépendances.

## Risques et travaux reportés

- Les tests historiques utilisant `process.chdir()` nécessitent le pool `forks`; les exécuter dans un pool de threads produit un faux échec.
- Le timeout DOCX demeure sensible à la concurrence, sans régression liée à ce lot.
- Prochaine amélioration suggérée : ajouter des labels explicites aux formulaires legacy du plan d’étude, après cadrage/test dédié.
- Prochaine amélioration suggérée : tester la reprise d’une session MCQ persistée lorsque le contrat produit le permettra explicitement.

## Verdict

Validable avec réserve environnementale documentée sur la campagne concurrente. Aucun push, merge, déploiement, accès Render/Auth0 ou accès à `data/mentor.db` n’a été effectué.

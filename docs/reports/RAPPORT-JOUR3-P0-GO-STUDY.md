# Jour 3 P0 — historique, corrections et erreurs persistées

Branche : `codex/day3-go-study`. Base : `0465323853841be67229ceb2937669c353e3507b`.

## Périmètre

- Les sessions STANDARD terminées rejoignent les examens blancs et activités historiques dans la progression. Score/date/durée proviennent des données enregistrées ; le nombre de questions est affiché si disponible.
- Les thèmes proviennent des mappings des versions effectivement jouées, dans le blueprint de la session. Sans mapping, affichage générique QCM ; aucun catalogue `subjects` n'est créé.
- `/progress/sessions/[sessionId]` ouvre les corrections historiques et le score enregistré. Le rendu détaillé existant est réutilisé sans modification. Les questions sans réponse restent explicitement sans réponse.
- GET `/api/mcq/sessions/[sessionId]/history` réutilise le contrôle d'identité et d'ownership existant, refuse les sessions inachevées, ne clôture pas les examens expirés et ne recalcule aucun score. Réponse `private, no-store`.
- `/progress#errors` présente les réponses incorrectes des sessions terminées : date, question, choix enregistré, bonne réponse, thème et lien vers la correction exacte. Le lien « Révision des erreurs » du hub QCM pointe vers cette section.
- Aucun changement au runner, à la reprise, aux mutations QCM, au calcul des scores ou aux contenus SNC/SNA.

## Validation

Tests ciblés : 49/49 puis 37/37 (75 tests distincts, 12 fichiers ; deux fichiers réexécutés après finalisation de la lecture historique).
Les contrôles SQLite utilisent exclusivement `:memory:`. Une lecture historique est testée avec `PRAGMA query_only=ON` et le compteur de changements inchangé. Sont également couverts : isolation learner, refus d'accès croisé, exclusion des sessions inachevées, reprise STANDARD/MOCK_EXAM, erreurs exactes et liens de correction, score enregistré, progression sans matières.

Typecheck : PASS.
Lint : PASS, zéro erreur ; deux avertissements préexistants dans le fichier non suivi `docs/content/candidates/SNA-V2/verify-isolated-import.ts`, non modifié.
Build : PASS (compilation, TypeScript et génération des pages, code 0).
Diff check : PASS.
Suite globale : PASS, 155 fichiers, 807 tests réussis, 1 ignoré, 0 échec ; 454,70 secondes. Une seule exécution : `node node_modules/vitest/vitest.mjs run --maxWorkers=1`.

Le lanceur `pnpm run build` est resté bloqué avant le lancement de Next.js et a été interrompu. Les commandes du projet sont exécutées directement : `node scripts/check-node-version.mjs`, puis `node node_modules/next/dist/bin/next build`. Aucun timeout ni configuration modifié.

## Limites et éléments reportés

- Les identifiants de thème sont ceux des mappings ; aucune traduction ou attribution de matière n'est inventée. Une session multi-thèmes conserve son score global, pas une maîtrise de chaque thème.
- Les erreurs restent un historique factuel, sans marquage « résolu », scheduler, répétition espacée ou nouveau score.
- Les anciennes sessions au kind NULL conservent leur traitement existant ; le raccordement ajouté concerne explicitement STANDARD.
- P1 : filtres/pagination, compteur d'erreurs répétées et suivi des révisions. P2 : graphiques et finition commerciale.
- Aucun test Auth0 live ni validation navigateur réalisé dans cette mission. Preview humain à effectuer avant décision de déploiement.

Production : aucune écriture, aucun accès DB réelle, migration, import, push ou déploiement. Aucune nouvelle table. Fichiers non suivis préexistants conservés.

## Décision

P0_COMPLETE = OUI
SAFE_FOR_PREVIEW = OUI
SAFE_FOR_PRODUCTION_DEPLOY_PLANNING = OUI
BLOCKERS = AUCUN pour le preview ; validation humaine du parcours avant déploiement.

Historique STANDARD, ouverture des sessions terminées, correction en lecture seule, contexte des erreurs et liens : PASS. MOCK_EXAM, reprise inachevée et ownership : PASS. P1/P2 reportés.

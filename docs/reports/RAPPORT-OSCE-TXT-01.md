# RAPPORT OSCE-TXT-01 — OSCE TEXTUEL

## Objectif et périmètre

Implémentation du moteur OSCE textuel sur `feat/osce-txt-01-core` : stations versionnées, rôles fermés, chronométrage serveur, révélations progressives, interactions append-only, rubric interne, assessment/debrief persistés, replay historique, remédiation traçable, API `/api/osce` et MIG-0011 additive. Aucun contenu clinique réel, multimodal, PILOT-WEB-01 ou claim PEBC.

## Fichiers créés

- `src/domain/osce/osce.ts`
- `src/domain/osce/index.ts`
- `src/domain/osce/osce.test.ts`
- `src/application/osce/osce-ports.ts`
- `src/application/osce/osce-use-cases.ts`
- `src/application/osce/osce-use-cases.test.ts`
- `src/infrastructure/osce/sqlite-osce-repository.ts`
- `src/infrastructure/osce/sqlite-osce-repository.integration.test.ts`
- `src/infrastructure/osce/server-osce.ts`
- `src/app/api/osce/route.ts`
- `src/app/api/osce/route.test.ts`
- `src/infrastructure/database/sqlite/migrations/definitions/mig-0011-osce-text-core.ts`
- `src/infrastructure/database/sqlite/migrations/mig-0011-osce-text-core.test.ts`
- `docs/reports/RAPPORT-OSCE-TXT-01.md`

## Fichiers modifiés

- registre global colocalisé dans `mig-0001-core-baseline.ts` : enregistrement minimal MIG-0011 uniquement ; définition/checksum MIG-0001 inchangés ;
- bootstrap et preflight : version 11 et validation du schéma OSCE ;
- tests historiques de migration/backup/activation : attentes de version courante 11 et fixtures ahead MIG-0012 ;
- `src/presentation/api/http-error-mapper.ts` : codes OSCE.

Aucun fichier supprimé. Les migrations MIG-0001 à MIG-0010 restent fonctionnellement immuables.

## Fonctionnalités et décisions

Le domaine impose UUID stables, versions positives et immuables, ordres stricts, rôles fermés et durée positive. `startedAt`, `durationSeconds`, `expiresAt`, `completedAt` et les états `ACTIVE`, `COMPLETED`, `EXPIRED` sont contrôlés côté application ; l'expiration est persistée. Les disclosures futures, scénario et rubric ne figurent pas dans le DTO public. Interactions, révélations, assessment, debrief et liens de remédiation sont persistés. Le replay relit la version/rubric et les événements historiques sans réévaluation.

`OsceAssessmentPolicy` est injectée et versionnée. `OsceRemediationPort` reçoit la provenance session/version/critère/erreur/evidence/rule version. Les erreurs critiques restent dans assessment, debrief et replay.

L'API `/api/osce` prend en charge station/état/replay et les actions start/interact/reveal/complete. Zod valide UUID, actions, rôles indirectement via le domaine et texte limité à 4 000 caractères. `trace_id` est propagé. Les erreurs internes sont masquées. Les logs structurés contiennent uniquement métadonnées/IDs, jamais texte, scénario, disclosure, rubric ou PII.

## Persistence et MIG-0011

MIG-0011 est additive `v10 → v11` et crée les 14 tables autorisées : stations/versions/objectifs/rôles/disclosures/rubrics/critères/sessions/interactions/disclosures révélées/assessments/critères d'assessment/debriefs/remediation links. FKs historiques `ON DELETE RESTRICT`, ensembles fermés par `CHECK`, unicités et index d'historique sont présents.

Tests synthétiques : bootstrap vierge vers v11, migration v10 vers v11, historique/checksum, tables, FK, CHECK, index, rollback transactionnel, `integrity_check=ok` et préservation legacy/MCQ/Foundation. Les modules Canadian Practice, QC/ON et Calculations Lab restent dans la chaîne et leurs tests globaux sont verts. MIG-0011 n'a pas été appliquée à la base utilisateur.

## Tests et quality gates

Toutes les commandes SQLite/runtime ont utilisé `MENTOR_ENABLE_DEMO_DATA=0` et un `MENTOR_DATA_DIRECTORY` absolu sous le répertoire temporaire Windows.

- Tests ciblés initiaux : 25/26 ; correction d'une fixture MCQ positionnelle.
- Tests ciblés OSCE/MIG-0011 finaux : 5 fichiers, 26/26.
- Typecheck final : réussi.
- ESLint global : réussi sans avertissement ; une première exécution avait expiré sans résultat et le même gate a été relancé.
- Première campagne globale : 437/457 ; 20 attentes historiques de version 10 corrigées vers 11, fixtures ahead déplacées vers MIG-0012.
- Tests migration affectés : 81 tests, puis 27 tests, tous verts.
- Campagne globale finale après correction d'expiration : 94/94 fichiers, 457/457 tests.
- Build Next.js 16.3.0 : réussi ; TypeScript réussi ; 21/21 pages générées ; `/api/osce` présente.
- `git diff --check` : réussi ; avertissements LF/CRLF non bloquants.

## Sécurité, données et exclusions

`data/mentor.db` n'a été ni ouverte, ni interrogée, ni modifiée pendant le BUILD. Toutes les bases étaient `:memory:` ou temporaires. MIG-0011 n'a pas été activée sur la base utilisateur. Aucun contenu clinique réel, donnée personnelle nouvelle, audio, voix, vidéo, transcription ou claim d'équivalence PEBC.

Exclus du commit : `.tmp-migration-runner/`, `DOCS1/`, `backups/`, `dossier evolution/`, `mentor-platform-restaure/`, `docs/reports/RAPPORT-ETAT-DEVELOPPEMENT.md`, `data/`.

## Problèmes, résolution et dette

Les échecs rencontrés étaient une fixture MCQ sans colonnes explicites, deux paramètres SQLite typés `unknown` et les attentes de version courante après ajout de MIG-0011 ; tous ont reçu des corrections minimales. L'état `EXPIRED` a été rendu persistant lors de la revue finale.

Dette maintenue : `TECH-DEBT-MIG-REGISTRY` (registre global colocalisé avec MIG-0001). La policy d'assessment déterministe et l'adapter de remédiation serveur sont minimaux ; toute policy clinique ou contenu réel exige validation/versionnement séparés.

## Actions non effectuées et verdict

Aucun merge, push de branche feature, activation MIG-0011, seed utilisateur ou travail du lot suivant. Verdict : **VALIDABLE**.

Prochaine étape : revue finale ciblée puis intégration contrôlée vers `main`.

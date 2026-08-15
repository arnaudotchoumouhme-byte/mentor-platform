# V6 OSCE-TXT-01 — OSCE textuel — Plan d'implémentation

## 1. Objectif et périmètre

Ce plan prépare OSCE-TXT-01 conformément au PRD V6.2.2 et à `docs/CODEX-GUARDRAILS.md`. Le lot doit fournir un moteur de stations textuelles versionnées et chronométrées, avec rôles explicites, révélations progressives, grille interne, assessment, debrief, replay historique et connexion aux contrats Foundation/Learner-remediation existants.

Sont exclus : voix, audio, transcription, vidéo, analyse multimodale, OSCE-MM-01, PILOT-WEB-01, comptes Web, facturation, contenu clinique réel et toute prétention d'équivalence ou de score officiel PEBC. Les tests utiliseront exclusivement des fixtures `TEST_FIXTURE`.

## 2. Inventaire ciblé et décision de schéma

L'inventaire ROAD-001 ne trouve aucun domaine, port, repository, API, test ou table OSCE existant. Les modules Coach, MCQ, Foundation et Calculations offrent des conventions réutilisables, mais leurs agrégats ne peuvent pas porter sans détournement :

- une définition de station et ses versions immuables ;
- des rôles et disclosures ordonnés ;
- une grille versionnée non exposable avant clôture ;
- des sessions chronométrées et leur historique ;
- des interactions textuelles append-only ;
- l'état des disclosures révélées ;
- un assessment, un debrief et un replay figés dans leur contexte historique.

Le schéma existant est donc insuffisant. Une persistence dédiée et une migration additive sont nécessaires. Le registre réel se termine à MIG-0010 et la base utilisateur est connue en version 10 après activation contrôlée. La candidate est **MIG-0011, v10 vers v11**, sans création ni activation dans cette mission.

## 3. Réutilisation architecturale

- Respecter `domain → application → infrastructure → presentation` et les ports/adapters.
- Réutiliser `LearningObjective` par UUID pour les objectifs/compétences ; ne pas dupliquer le curriculum Foundation.
- Réutiliser les conventions `IdGenerator.next()` et `Clock.now()` ; tous les identifiants persistés sont des UUID stables, jamais un index, une concaténation ou un timestamp seul.
- Réutiliser `resolveTraceId`, `Logger`/`structuredLogger`, `AppError`, `http-error-mapper` et les réponses API communes.
- Réutiliser les catégories et références de remédiation existantes lorsqu'elles représentent correctement l'erreur ; ne pas créer de Learner Model parallèle.
- Réutiliser les patterns SQLite paramétrés, les transactions et l'historique append-only des modules MCQ, Foundation et Calculations.
- Coach peut inspirer l'orchestration textuelle et l'évaluation déterministe, sans journaliser le texte complet ni introduire de contenu clinique réel.

## 4. Domain Model minimal

Concepts proposés, à réduire si l'implémentation démontre qu'un type valeur suffit :

- `OsceStation` : identité stable, code stable et liens vers les objectifs Foundation.
- `OsceStationVersion` : version, titre, durée, scénario textuel, statut, provenance, dates et références de rôle/rubric/disclosure.
- `OsceRole` : rôle fermé de la station (`LEARNER`, `PATIENT`, `CAREGIVER`, `CLINICIAN`, `EVALUATOR_SYSTEM`) et instructions autorisées.
- `OsceDisclosure` : ordre, déclencheur, contenu caché et règle de révélation.
- `OsceRubric` / `OsceRubricCriterion` : grille interne versionnée, catégorie/compétence, importance, critical flag et règle d'évidence.
- `OsceSession` : apprenant, version exacte de station, état, démarrage, durée, expiration et clôture.
- `OsceInteraction` : événement textuel append-only avec rôle, ordre, timestamp et disclosure contextuelle éventuelle.
- `OsceAssessment` : résultat interne figé par critère, justification/evidence et erreurs critiques.
- `OsceDebrief` : synthèse structurée produite après clôture seulement.
- `OsceReplay` : projection ordonnée de l'historique persisté, sans recalcul sur une nouvelle version.

Invariants principaux : station publiée immuable ; session liée à une version précise ; durée strictement positive ; transitions d'état fermées ; interaction interdite après clôture ou expiration ; disclosure future absente des sorties ; rubric/assessment/debrief privés avant clôture ; erreur critique historiquement visible et bloquante selon la policy versionnée.

## 5. Versionnement des stations et de la rubric

- `station_id` reste stable ; chaque publication crée une nouvelle `station_version_id` et un numéro de version unique.
- Une session conserve `station_version_id`, jamais seulement la station courante.
- Rôles, disclosures et critères sont attachés à la version de station afin que le replay ne dérive pas.
- La rubric porte une identité/version technique liée à la station version ; ses critères ont des UUID stables.
- Une version `PUBLISHED`/`RETIRED` n'est pas mise à jour silencieusement. Les corrections passent par une nouvelle version.
- La provenance est technique et obligatoire lorsque du contenu validé sera ultérieurement chargé ; aucune source ou station réelle n'est seedée ici.

## 6. Persistence proposée

Tables candidates :

- `osce_stations` : `station_id` PK, `code` UNIQUE, `created_at`.
- `osce_station_versions` : PK, FK station, `version`, titre, durée, scénario, statut, provenance, dates, UNIQUE `(station_id, version)`.
- `osce_station_objectives` : FKs station version et `learning_objectives`, PK composite.
- `osce_station_roles` : `role_id` PK, FK station version, type de rôle, label/instructions, ordre.
- `osce_disclosures` : `disclosure_id` PK, FK station version, ordre, type de déclencheur, condition structurée, contenu, UNIQUE par ordre.
- `osce_rubrics` : `rubric_id` PK, FK station version, version/rule version.
- `osce_rubric_criteria` : `criterion_id` PK, FK rubric, description, compétence, importance, critical flag, ordre.
- `osce_sessions` : `session_id` PK, FKs apprenant/version, état, `started_at`, `duration_seconds`, `expires_at`, `completed_at`, trace technique.
- `osce_interactions` : `interaction_id` PK, FK session/rôle, séquence, timestamp, texte, disclosure contextuelle éventuelle, UNIQUE `(session_id, sequence)`.
- `osce_session_disclosures` : FKs session/disclosure, date et événement de révélation, PK composite.
- `osce_assessments` : `assessment_id` PK, FK session UNIQUE, rule version, résultat interne, date.
- `osce_assessment_criteria` : FKs assessment/criterion, résultat, justification/evidence, critical flag, PK composite.
- `osce_debriefs` : `debrief_id` PK, FK session UNIQUE, données structurées et date.
- `osce_remediation_links` : identité UUID, FK session/criterion et référence de remédiation existante, provenance et date.

Les noms et le nombre final de tables doivent être confirmés pendant la revue humaine ; une table peut être fusionnée seulement si l'historique, les contraintes et la confidentialité restent explicites. Toutes les FKs historiques utilisent `ON DELETE RESTRICT`. Les statuts, rôles et types sont fermés par `CHECK`. Les index couvrent station/version, sessions apprenant/état, ordre des interactions, disclosures révélées et recherche d'assessment/replay.

## 7. Tentative, timing et transitions

`OsceClock` réutilise le contrat Clock. Au démarrage, l'application persiste `startedAt`, `durationSeconds` et `expiresAt`. L'état dérivé et persisté distingue `ACTIVE`, `COMPLETED` et `EXPIRED`. Toute commande revalide l'heure côté application/domaine ; aucun timer UI n'est autoritaire.

Les transitions et événements sont transactionnels. Une interaction, révélation ou clôture après expiration échoue de manière fermée. La clôture est idempotente ou refuse explicitement les doublons selon la convention retenue, sans écraser l'historique.

## 8. Révélation progressive et confidentialité

- Une disclosure définit son ordre et un déclencheur fermé : commande autorisée, interaction/étape atteinte ou événement de session.
- La liste publique d'une station/session ne sérialise jamais le contenu d'une disclosure non révélée.
- L'API retourne uniquement les disclosures présentes dans `osce_session_disclosures`.
- Les réponses attendues, la rubric complète et les règles d'évaluation restent côté serveur avant clôture.
- Un test de contrat inspecte la réponse sérialisée pour prouver l'absence de fuite de disclosure future et de rubric privée.

## 9. Assessment, erreurs critiques et debrief

L'assessment est interne au produit, produit seulement après clôture, par une policy injectée et versionnée. Chaque critère conserve résultat, évidence et justification. Les erreurs critiques restent dans l'assessment et le replay même après remédiation ou re-test.

Le debrief est une projection persistée et structurée : réussites, critères non satisfaits, erreurs critiques, explications, objectifs, actions correctives et prochain entraînement. Aucun score n'est décrit comme officiel, prédictif ou équivalent au PEBC.

## 10. Replay historique

Le replay lit les événements persistés dans l'ordre : démarrage, interactions, disclosures, expiration/clôture, assessment, debrief et liens de remédiation. Il conserve les timestamps, rôles et identifiants de version d'origine. Il ne réévalue pas la session avec une station, une rubric ou une policy plus récente.

## 11. Connexion Learner Model / remediation

Créer un port d'application étroit, par exemple `OsceRemediationPort`, qui reçoit une référence traçable `{ learnerId, sessionId, stationVersionId, criterionId, errorCategory, critical, evidenceRef, ruleVersion }`. L'adapter cible les contrats de recommandation/remédiation existants disponibles ; il ne crée ni nouveau moteur de maîtrise ni taxonomie concurrente.

Chaîne de provenance obligatoire : session/version → critère/erreur → action corrective → éventuel re-test. L'indisponibilité du port échoue ou se dégrade explicitement selon la décision humaine ; elle ne doit jamais effacer l'assessment.

## 12. Migration candidate MIG-0011

- Source : version 10.
- Cible : version 11.
- Nature : additive uniquement.
- Créations : tables, contraintes et index OSCE validés après revue.
- Aucun changement fonctionnel de MIG-0001 à MIG-0010 ; l'enregistrement minimal dans le registre global existant reste la seule adaptation historique tolérée, avec la dette `TECH-DEBT-MIG-REGISTRY` inchangée.
- Tests : bootstrap vierge vers v11 ; migration synthétique v10 vers v11 ; checksum/historique ; FK/CHECK/index ; rollback transactionnel ; préservation legacy, MCQ, Foundation, Canadian Practice, QC/ON et Calculations Lab.
- Activation utilisateur séparée : preflight, nouveau backup vérifié, autorisation humaine explicite, `ControlledMigrationActivation.execute()` et post-validation. Aucun seed OSCE utilisateur automatique.

## 13. API minimale

Route candidate : `/api/osce`, selon les conventions App Router existantes. Actions minimales : obtenir une version autorisée, démarrer, lire l'état public, enregistrer une interaction, révéler une disclosure autorisée, terminer, lire assessment/debrief après clôture et lire replay.

Validation Zod stricte : UUID, action discriminée, rôle autorisé, taille/forme du texte et transitions. Les erreurs internes, SQL, stack traces, disclosures futures et rubric privée ne sont jamais exposés. `trace_id` est propagé dans les réponses.

## 14. Observabilité

Événements structurés minimaux : `osce.session_started`, `osce.interaction_recorded`, `osce.disclosure_revealed`, `osce.session_completed`, `osce.assessment_completed`.

Contexte autorisé : IDs techniques, version, état, rôle, ordre, catégorie d'erreur, critical flag, durée. Sont interdits dans les logs : texte d'interaction, scénario/disclosure, rubric, contenu clinique, données personnelles, secrets et réponses sensibles.

## 15. Security et privacy

Threat review ciblée : fuite de disclosure/rubric, accès inter-session, UUID forgé, rôle invalide, interaction tardive, replay recalculé, mutation d'une version publiée, injection SQL, payload excessif et journalisation de contenu sensible.

Mesures : fail closed, contrôle de possession/session, requêtes paramétrées, transactions, historique append-only, validation stricte, limites de taille, sorties minimales, erreurs stables et masquage interne. Aucune nouvelle donnée personnelle n'est nécessaire au-delà de l'identifiant apprenant déjà utilisé par le produit ; aucune donnée clinique réelle ne sera créée.

## 16. Stratégie de tests

- Domaine : station/version, UUID, rôles, durée, transitions, expiration, disclosures, rubric, erreur critique et clôture.
- Application : démarrage, interaction, révélation, completion, assessment, debrief, replay et port de remédiation.
- Sécurité : station/version/session inconnue, UUID/rôle/payload invalides, interaction après expiration/clôture, disclosure future, rubric/debrief prématurés et isolation des sessions.
- Persistence : round-trip des versions, sessions, interactions, disclosures, assessment/debrief et replay historique ; SQL paramétré ; transactions.
- Migration synthétique : v10 vers v11 et bootstrap vierge ; contraintes/index/checksums ; préservation de toutes les structures antérieures.
- API : trace ID, validation, masquage interne et absence de fuite dans les DTO.

Pendant le BUILD : tests OSCE ciblés. À la fin : typecheck, lint, suite globale une seule fois et un build unique puisque l'API/runtime changera. Toutes les commandes SQLite utiliseront `MENTOR_ENABLE_DEMO_DATA=0` et un `MENTOR_DATA_DIRECTORY` temporaire absolu ; `data/mentor.db` restera fermée.

## 17. Fichiers probables après validation

- `src/domain/osce/`
- `src/application/osce/`
- `src/infrastructure/osce/`
- `src/app/api/osce/`
- `src/infrastructure/database/sqlite/migrations/definitions/mig-0011-osce-text-core.ts`
- `src/infrastructure/database/sqlite/migrations/mig-0011-osce-text-core.test.ts`
- adaptations minimales registre/bootstrap/preflight et tests de version 11
- `src/presentation/api/http-error-mapper.ts`
- `docs/reports/RAPPORT-OSCE-TXT-01.md`

## 18. Rollback, backup et récupération

MIG-0011 doit être transactionnelle et additive. Avant toute activation réelle : preflight v10 exact, plan contenant uniquement MIG-0011, backup SQLite vérifié, autorisation humaine fraîche et post-validation v11. En cas d'échec, ne pas réparer ni remplacer directement la base active ; conserver le backup et utiliser `restoreToStaging()` uniquement pour inspection et décision humaine.

## 19. Critères QA / Definition of Done

- station textuelle/versionnée, rôles et UUID stables ;
- chronométrage serveur et transitions contrôlées ;
- disclosure et rubric protégées ;
- interactions append-only ;
- assessment/debrief après clôture ;
- replay historique non recalculé ;
- erreurs critiques et remédiation traçables ;
- aucune claim PEBC, donnée clinique réelle ou composant multimodal ;
- tests ciblés, typecheck, lint, tests globaux et build final verts ;
- MIG-0011 testée uniquement sur bases synthétiques pendant le BUILD ;
- `data/mentor.db` non ouverte pendant le BUILD ;
- rapport final complet et commit dédié, sans élément protégé.

## 20. Décisions humaines requises avant BUILD

Valider :

1. la nécessité et l'identifiant de MIG-0011 v10 vers v11 ;
2. la liste et les noms définitifs des tables ;
3. les rôles fermés et les déclencheurs de disclosure ;
4. le caractère persisté de l'assessment/debrief plutôt qu'une projection recalculée ;
5. le port exact de connexion à Learner/remediation ;
6. l'absence de contenu clinique réel, de voix et de claim PEBC ;
7. la stratégie de récupération contrôlée.

Jusqu'à cette validation, aucune migration, branche fonctionnelle ou implémentation OSCE ne doit commencer.

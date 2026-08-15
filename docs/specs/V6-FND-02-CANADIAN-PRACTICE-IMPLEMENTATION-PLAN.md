# V6 FND-02 — Canadian Practice Core — Implementation Plan

Baseline fonctionnelle : PRD V6.2.2. Ce plan respecte `docs/CODEX-GUARDRAILS.md` et les normes Engineering, Observability et Security V1.0.

## 1. Scope

FND-02 ajoute le noyau technique permettant de représenter et consulter, sans prétention d'autorité réglementaire :

- système de santé canadien;
- processus de soins et pratique pharmaceutique;
- règles fédérales pertinentes;
- première configuration provinciale : Ontario;
- éthique et professionnalisme;
- sécurité;
- documentation professionnelle.

Toute règle sensible à la juridiction expose obligatoirement `jurisdiction`, `province` lorsque applicable, `sourceVersionId`, `ruleVersion`, `verifiedAt` et sa fenêtre `effectiveFrom`/`effectiveTo`. Aucun contenu réglementaire réel, seed publié, décision PEBC, conseil juridique ou règle ontarienne inventée n'entre dans ce plan.

## 2. Reuse existant

- Réutiliser `Source`/`SourceVersion` pour la provenance documentaire immuable; une source officielle doit utiliser `OFFICIAL_SOURCE`.
- Réutiliser `CurriculumVersion`, le bloc `CAN`, `CurriculumUnit` et `LearningObjective` pour la structure pédagogique. Ne pas créer un catalogue de topics concurrent.
- Référencer les objectifs Foundation par UUID; ne pas les recopier dans Canadian Practice.
- Réutiliser `AppError`, `http-error-mapper`, `resolveTraceId`, `Logger`/`structuredLogger`, les ports/adapters et les requêtes SQLite paramétrées.
- Conserver la séparation `domain → application → infrastructure → presentation`.

Limite démontrée : les structures actuelles ne portent ni versions de règles juridictionnelles, ni province, ni période d'effet, ni date de vérification. Elles ne suffisent donc pas seules à AC-FOUND-005.

## 3. Domain contracts

Contrats minimaux proposés :

- `Jurisdiction`: `FEDERAL` ou `PROVINCIAL`; une règle provinciale exige un code province, initialement `ON`.
- `PracticeRule`: identité UUID stable, code stable et lien obligatoire vers un `LearningObjective` du bloc CAN.
- `PracticeRuleVersion`: identité UUID, `practiceRuleId`, `ruleVersion`, `jurisdiction`, `province`, `sourceVersionId`, `verifiedAt`, `effectiveFrom`, `effectiveTo`, statut `DRAFT | ACTIVE | RETIRED`, résumé pédagogique et avertissement d'indépendance.

Invariants :

- `province = null` pour `FEDERAL`; province obligatoire et `ON` seule autorisée dans la configuration initiale pour `PROVINCIAL`;
- source, version et date de vérification obligatoires;
- fenêtre d'effet cohérente; une règle expirée/retirée n'est jamais retournée comme active;
- versions insert-only; une nouvelle version ne modifie pas les lectures historiques;
- aucun calcul d'applicabilité silencieux en cas de juridiction inconnue, source absente ou conflit temporel;
- domaine pur, sans SQLite, Next.js, React, OpenAI ou contenu réglementaire codé en dur.

Ne pas créer `CanadianPracticeTopic`: les unités/objectifs Foundation remplissent déjà ce rôle. Ne pas créer `PracticeSourceReference`: `SourceVersion` est la référence canonique; les métadonnées d'affichage proviennent de `Source` et de la version de règle.

## 4. Persistence/migration decision

**MIG-0008 — Canadian Practice Core est nécessaire.**

Migration additive v7 → v8 proposée, sans la créer dans cette mission :

- `canadian_practice_rules`: `practice_rule_id` PK, `code` UNIQUE, `learning_objective_id` FK restrictive;
- `canadian_practice_rule_versions`: PK, FK règle et `source_version_id`, version, juridiction, province, `verified_at`, fenêtre d'effet, statut, résumé, avertissement, date de création;
- unicité `(practice_rule_id, rule_version)`;
- index de résolution `(jurisdiction, province, status, effective_from, effective_to)` et index source;
- `CHECK` fédéral/provincial, dates cohérentes, statuts fermés et champs obligatoires;
- `ON DELETE RESTRICT` pour préserver règles, sources et historique.

Le repository expose insertions de versions, lecture par ID/version et résolution à une date donnée. Aucune mise à jour destructive, aucun seed réglementaire réel et aucune modification de MIG-0001 à MIG-0007.

Tests de migration : base synthétique v7 → v8, bootstrap vierge → v8, historique/checksums, contraintes, index, préservation intégrale des tables legacy, MCQ et Foundation. Backup vérifié et activation contrôlée séparée avant toute base utilisateur; récupération vers staging uniquement.

## 5. Sources/content boundary

- Structure technique : contrats, tables, ports, API de lecture et fixtures synthétiques clairement marquées.
- Règles réelles : importées seulement après validation humaine de l'autorité, de la juridiction, de la version, de la date d'accès/vérification, des droits et de la fenêtre d'effet.
- Contenu pédagogique : distinct de la règle source; résumé/reformulation révisé, jamais présenté comme texte officiel.

Sources officielles à valider humainement avant tout seed ou publication : autorités fédérales canadiennes compétentes et corpus législatif officiel; Health Canada; Ontario e-Laws; Ontario College of Pharmacists; NAPRA; PEBC uniquement pour le périmètre d'examen. La liste exacte, les URL, licences, versions et dates de consultation doivent être approuvées; aucune recherche Internet n'est réalisée ici.

## 6. Security/privacy

Mini threat review : règle périmée, mauvaise province, source non officielle/non vérifiée, version/date absente, confusion PEBC/permis provincial, contenu non fiable et fuite de contenu dans les logs.

Mesures : validation stricte, allowlist initiale `CA`/`ON`, provenance `OFFICIAL_SOURCE`, refus fail-closed, historique immuable, avertissement d'indépendance, requêtes paramétrées, sorties API sans détails internes et logs limités aux IDs/métadonnées non sensibles.

**Aucune nouvelle donnée personnelle n'est introduite.** Les règles et sources sont du contenu de référence. Ne pas journaliser texte réglementaire complet, contenu documentaire, données apprenant, secrets ou PII.

## 7. Observability

- Propager/créer `trace_id` à la frontière API.
- Événements structurés minimaux : `canadian_practice.rule_version_loaded`, `canadian_practice.rule_query_completed`, `canadian_practice.rule_query_rejected`.
- Contexte autorisé : IDs techniques, juridiction, province, `ruleVersion`, `sourceVersionId`, statut et durée; aucun texte intégral.
- Erreurs stables proposées : `CANADIAN_PRACTICE_RULE_INVALID`, `CANADIAN_PRACTICE_JURISDICTION_UNSUPPORTED`, `CANADIAN_PRACTICE_SOURCE_REQUIRED`, `CANADIAN_PRACTICE_VERSION_NOT_FOUND`, `CANADIAN_PRACTICE_RULE_NOT_EFFECTIVE`.
- Préserver la `cause` dans les wrappers; mapper les erreurs déterministes en HTTP sans exposer les détails internes.

## 8. Test plan

Tests minimum mesurables :

- versionnement insert-only et lecture historique non rétroactive;
- Ontario accepté comme première province, autre province refusée tant que non configurée;
- distinction fédéral/provincial et invariants `province`;
- source/version/date de vérification obligatoires;
- règle expirée ou retirée exclue des résultats actifs mais lisible historiquement;
- juridiction incorrecte refusée;
- chaque DTO de règle juridictionnelle contient province applicable, source, version et date de vérification;
- repository SQLite, résolution temporelle et contraintes;
- contrat API/port, validation Zod, trace ID, error codes et masquage interne;
- frontières d'architecture;
- MIG-0008 synthétique uniquement si le schéma proposé est validé.

Fixtures exclusivement synthétiques (`TEST_FIXTURE`), sans règle canadienne réelle.

## 9. Files likely to change

Pass 1 probable :

- `src/domain/canadian-practice/` — contrats, erreurs et tests;
- `src/application/canadian-practice/canadian-practice-ports.ts`;
- `src/infrastructure/canadian-practice/sqlite-canadian-practice-repository.ts` et tests;
- `src/infrastructure/database/sqlite/migrations/definitions/mig-0008-canadian-practice-core.ts` et test;
- adaptations minimales du registre, bootstrap, preflight et tests de version 8.

Pass 2 probable :

- cas d'usage de lecture/résolution dans `src/application/canadian-practice/`;
- composition serveur et API minimale dans `src/infrastructure/canadian-practice/` et `src/app/api/canadian-practice/`;
- `src/presentation/api/http-error-mapper.ts`;
- tests API/observabilité;
- `docs/reports/RAPPORT-FND-02.md`.

Ne modifier `Source`, Foundation ou leurs tables que si un test démontre un manque non couvert par les deux tables proposées.

## 10. BUILD strategy

Deux passes maximum :

1. Domaine + ports + repository + MIG-0008 additive + tests ciblés.
2. Application + API de lecture minimale + observabilité + tests ciblés, documentation et commit.

Fin de lot : typecheck, lint, suite globale une fois, puis **un seul build** car une route API/runtime est ajoutée. Ne pas répéter un gate vert sans changement concerné.

## 11. Human decisions required

Avant développement : valider les noms des deux tables, l'allowlist initiale `CA`/`ON`, le statut et la portée de MIG-0008, ainsi que le fait qu'aucune règle réelle ne sera seedée.

Avant contenu/publication : approuver les autorités officielles, URL, licences, versions, dates de consultation, règles réelles, résumés pédagogiques, reviewer et avertissement utilisateur. Toute extension provinciale exige une décision et des tests dédiés.

Toute activation de MIG-0008 sur `data/mentor.db` reste une mission séparée avec preflight, backup vérifié, autorisation humaine et post-validation.

## 12. Definition of Done

- périmètre A–G représentable sans contenu réglementaire inventé;
- domaine indépendant et réutilisation de SourceVersion/Foundation démontrée;
- historique des règles immuable et affichage juridiction/source/version/date vérifié;
- tests ciblés et migration synthétique verts;
- typecheck, lint, tests globaux et build final nécessaires verts selon la stratégie économique;
- mini threat review et observabilité couvertes;
- rapport FND-02 à jour, diff propre et commits dédiés;
- aucune règle réelle publiée sans validation humaine;
- `data/mentor.db` non touchée pendant le BUILD et aucune activation implicite.

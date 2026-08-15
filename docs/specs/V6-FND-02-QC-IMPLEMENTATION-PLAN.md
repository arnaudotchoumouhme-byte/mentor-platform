# V6 FND-02-QC — Quebec Practice Extension — Implementation Plan

## 1. Objectif et périmètre

Étendre Canadian Practice Core à la province `QC` sans modifier rétroactivement FND-02 ni MIG-0008. Le futur lot doit préserver `FEDERAL`, `ON`, l'historique des règles et toutes les données existantes. Il réutilisera `PracticeRule`, `PracticeRuleVersion`, `SourceVersion`, `LearningObjective`, le repository, les requêtes applicatives, l'API et les événements d'observabilité existants.

Aucun contenu réglementaire réel, seed Québec, traduction juridique ou nouvelle donnée personnelle n'entre dans ce périmètre. Les fixtures resteront exclusivement `TEST_FIXTURE`.

## 2. Raison technique de la migration

Le schéma v8 ne peut pas stocker `QC` :

- `province TEXT CHECK(province IS NULL OR province='ON')` refuse toute valeur différente de `ON` ou `NULL`;
- `CHECK((jurisdiction='FEDERAL' AND province IS NULL) OR (jurisdiction='PROVINCIAL' AND province='ON'))` impose `ON` à toute règle provinciale;
- le domaine limite `CanadianProvince` à `"ON"`;
- le repository limite ses contrats et sa résolution à `"ON" | null`;
- la validation Zod de l'API n'accepte que `ON`.

Une simple adaptation TypeScript serait incohérente avec la base et échouerait à l'insertion. MIG-0008 est historique, appliquée et immuable; elle ne doit pas être modifiée.

## 3. Décision proposée — MIG-0009

Une migration contrôlée **MIG-0009 — Quebec Practice Extension**, de version `8 → 9`, est requise avant l'implémentation QC.

La décision humaine préalable doit approuver :

- l'extension fermée de l'allowlist provinciale de `ON` à `ON | QC`;
- la reconstruction SQLite de `canadian_practice_rule_versions` nécessaire pour remplacer ses contraintes `CHECK`;
- l'absence de contenu réglementaire réel et de seed;
- le niveau de risque et la procédure de backup/restauration.

MIG-0009 ne doit pas être créée avant cette approbation.

## 4. Stratégie SQLite proposée

SQLite ne permet pas de modifier directement une contrainte `CHECK`. La migration devra effectuer une reconstruction transactionnelle et forward-only de la table de versions :

1. vérifier les préconditions v8, l'intégrité et l'absence de valeurs provinciales hors `ON`;
2. créer une table temporaire avec les mêmes colonnes, clés étrangères, unicité et statuts que v8;
3. remplacer uniquement les contraintes provinciales par :
   - `province IS NULL OR province IN ('ON','QC')`;
   - `FEDERAL => province IS NULL`;
   - `PROVINCIAL => province IN ('ON','QC')`;
4. copier toutes les lignes existantes sans transformation fonctionnelle;
5. vérifier les nombres de lignes et les valeurs copiées;
6. remplacer la table v8 dans la même transaction;
7. recréer les indexes de résolution et de provenance sous leurs noms canoniques;
8. exécuter les postconditions de schéma, clés étrangères, historique et intégrité.

La table `canadian_practice_rules`, les sources, Foundation, MCQ et les tables legacy ne doivent pas être modifiées. Aucun `UPDATE` métier, seed ou suppression de règle n'est autorisé.

## 5. Préservation Ontario et Federal

- Les lignes `FEDERAL` restent associées à `province=NULL`.
- Les lignes provinciales `ON` sont copiées à l'identique.
- `QC` devient la seule nouvelle valeur autorisée.
- Toute autre province reste refusée par le domaine, l'API, le repository et la base.
- La résolution doit rester isolée par `jurisdiction` et `province`; une requête QC ne doit jamais retourner ON, et inversement.
- L'historique `(practice_rule_id, rule_version)` reste insert-only et non rétroactif.

## 6. Adaptations applicatives ultérieures

Après validation de MIG-0009 seulement :

- étendre `CanadianProvince` à `"ON" | "QC"`;
- centraliser l'allowlist fermée sans créer de moteur juridique générique;
- adapter les types du port/repository et la validation API;
- conserver la provenance, `ruleVersion`, `verifiedAt`, les périodes d'effet et l'avertissement d'indépendance;
- réutiliser les événements `canadian_practice.rule_version_loaded`, `canadian_practice.rule_query_completed` et `canadian_practice.rule_query_rejected`;
- préparer la future présentation FR/EN avec des identifiants métier indépendants de la langue, sans traduire ni dupliquer une règle juridique.

## 7. Tests synthétiques requis

### Migration

- base synthétique v8 → v9 avec données Federal et Ontario préservées bit à bit;
- bootstrap vierge → v9;
- historique/checksums MIG-0001 à MIG-0009;
- contraintes : `ON` et `QC` acceptés, autre province refusée, Federal avec province refusé, Provincial sans province refusé;
- clés étrangères, unicité et indexes préservés;
- nombres de lignes identiques avant/après pour toutes les tables préexistantes;
- legacy, MCQ, Foundation, SourceVersion et Canadian Practice v8 préservés.

### Domaine, persistence, application et API

- QC accepté et résolu;
- ON et Federal inchangés;
- isolation ON/QC dans les deux directions;
- province inconnue et combinaison incohérente refusées;
- historique indépendant et non rétroactif;
- source/version/date obligatoires;
- DTO QC avec juridiction, province, SourceVersion, ruleVersion, verifiedAt, dates d'effet, statut et disclaimer;
- trace ID et événements structurés sans texte réglementaire, PII ou secret.

Toutes les bases et données de test doivent être synthétiques, avec `MENTOR_DATA_DIRECTORY` temporaire explicite avant toute commande susceptible de charger le runtime.

## 8. Backup, activation et récupération

Le BUILD ne doit jamais ouvrir ni migrer `data/mentor.db`. Après intégration séparée du code, toute activation utilisateur de MIG-0009 exigera :

1. `ControlledMigrationActivation.prepare()` frais sur une base exactement v8;
2. plan contenant uniquement `EXECUTE MIG-0009` vers v9;
3. backup SQLite frais créé par `prepare()`, manifeste/checksum/empreinte/integrity vérifiés;
4. autorisation humaine explicite avec les identifiants frais et TTL valide;
5. `ControlledMigrationActivation.execute()` uniquement;
6. post-validation version 9, historique, intégrité, schéma, indexes et préservation des comptes de données.

En cas d'échec, ne jamais remplacer directement la base active. Conserver le backup et utiliser uniquement `SqliteBackupService.restoreToStaging()` vers un nouveau fichier, puis attendre une décision humaine.

## 9. Impact données et risques

Impact attendu : aucune transformation du contenu; reconstruction structurelle de la seule table `canadian_practice_rule_versions`. Risques bloquants : contrainte v8 inattendue, historique/checksum incohérent, verrou SQLite, espace disque insuffisant, échec de copie ou d'index, perte de ligne, mauvaise isolation ON/QC et échec de post-validation.

Mesures : transaction unique, préconditions fermées, comparaison avant/après, FKs activées, tests synthétiques, backup vérifié et activation contrôlée. Aucune donnée personnelle nouvelle.

## 10. Sources et contenu

Le support technique QC ne valide aucune autorité ni règle réelle. Avant tout contenu futur, une validation humaine distincte devra approuver les sources officielles, licences, versions, dates de consultation, résumés et traductions. Familles candidates à évaluer ultérieurement : législation officielle du Québec, Ordre des pharmaciens du Québec, RAMQ lorsque pertinente, autorités gouvernementales québécoises compétentes, NAPRA, autorités fédérales compétentes et PEBC uniquement pour le périmètre d'examen.

## 11. Definition of Done

FND-02-QC sera validable uniquement si :

- MIG-0009 v8→v9 a été préalablement approuvée, créée sans modifier MIG-0001 à MIG-0008 et testée synthétiquement;
- QC, ON et Federal sont supportés avec isolation stricte;
- aucune autre province n'est acceptée;
- provenance, ruleVersion, verifiedAt et périodes d'effet restent obligatoires;
- historique, données v8, indexes et clés étrangères sont préservés;
- aucun contenu réglementaire réel, seed ou traduction juridique n'est inventé;
- sécurité, confidentialité, observabilité et bilinguisme futur sont documentés;
- tests QC ciblés, typecheck, lint, tests globaux et build éventuel sont verts;
- `data/mentor.db` n'a pas été ouverte pendant le BUILD et aucune migration utilisateur n'a été exécutée;
- rapport FND-02-QC, diff et commit dédié sont propres.

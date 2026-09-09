# Rapport LOT 9 / MLE-01 — Concept Catalog

Date : 9 septembre 2026. Branche : `codex/lot-9-mle-01`.

## Objectif et périmètre

Installer le catalogue conceptuel, les identifiants stables, le graphe de prérequis et les références aux contenus Mentor. Le pilote est **Épilepsie — principes de traitement et sécurité des antiépileptiques**. Tous les concepts et rattachements proposés sont **DRAFT**. Ce lot ne valide ni leur publication clinique ni un moteur de maîtrise.

Aucune connexion, migration ou modification de la base Render de production ; aucun déploiement. Les migrations et imports de vérification utilisent exclusivement des bases synthétiques en mémoire ou dans des répertoires temporaires.

## Architecture implémentée

- Domaine : validation du catalogue, versions, priorités, références et graphe ; inventaire éditorial des compétences couvertes et manquantes.
- Application : ports du catalogue et des ressources natives ; lecture et import transactionnel de brouillons ; définition du pilote.
- Infrastructure : repository SQLite et résolution des références natives existantes.
- API : lecture éditoriale `GET /api/mle/catalog`, désactivée par défaut, sans cache et avec contrôle d'accès avant chargement de la base.
- Prévisualisation : `node scripts/run-tsx.mjs scripts/mle-catalog-preview.ts`. Ce script refuse tout argument de base cible et crée toujours une nouvelle base synthétique temporaire. Il ne charge pas la configuration de la base applicative.

Il n'existe ni import automatique au démarrage, ni endpoint d'écriture/publication, ni écran apprenant MLE. Le catalogue ne contient pas de réponses cliniques, de doses ou de recommandations thérapeutiques. Sources, RAG, citations et contrôles cliniques existants restent l'autorité clinique.

## Modèle de données et migration

L'inspection du registre canonique a établi que MIG-0017 était la dernière migration ; **MIG-0018**, de 17 à 18, est le prochain numéro disponible. Les définitions historiques ne sont pas modifiées.

| Table ajoutée | Rôle |
|---|---|
| `mle_blueprints` | Identité/version du blueprint, date d'application, source officielle et provenance |
| `mle_categories` | Domaines/catégories PEBC et poids officiels, distincts des priorités |
| `mle_competencies` | Codes officiels rattachés à leur catégorie |
| `mle_concepts` | UUID stable + version, titre, priorité, statut, auteur, provenance, création et revue |
| `mle_concept_mappings` | Référence composite concept/version/blueprint/compétence |
| `mle_resource_links` | Références typées aux six familles natives, version et provenance |
| `mle_dependencies` | Arêtes entre versions exactes, relation, provenance et création |

Deux index servent les recherches par compétence et par cible du graphe. Les contraintes vérifient les énumérations, les clés étrangères, la cohérence de revue et l'identité des versions. Le validateur de schéma vérifie le DDL canonique, y compris les index et les contraintes. Le bootstrap et le précontrôle reconnaissent le schéma 18 ; une base 17 existante reste soumise aux procédures de sauvegarde et d'autorisation.

Les imports du repository sont atomiques (`BEGIN IMMEDIATE`), refusent l'écrasement et ajoutent une version contiguë. Une version conceptuelle et ses mappings sont conservés ensemble ; pas de mise à jour destructive. Les dates de création et la provenance sont conservées ; une révision produit une nouvelle version. Les contrôles applicatifs rejettent les références absentes, les doublons, les auto-prérequis et les cycles. Les relations explicatives ou associatives ne sont pas des prérequis.

## PEBC : couverture officielle séparée des priorités

Référence : [Blueprint officiel PEBC 03-2026](https://pebc.ca/wp-content/uploads/pdfs/Qual%20EN/Pharmacist_Qualifying_Exam_Blueprint.pdf), applicable depuis mai 2026, retenu lors de la validation architecturale. Le premier jour du mois représente l'application mensuelle dans le modèle.

| Catégorie | Total | QCM | OSCE | Compétences |
|---|---:|---:|---:|---|
| 1A Clinical Care | 45 % | 50 % | 40 % | 1.1–1.5 |
| 1B Distribution | 14 % | 20 % | 8 % | 1.6–1.10 |
| 2 Knowledge and Expertise | 9 % | 11 % | 7 % | 2.2 |
| 3 Communication and Collaboration | 16 % | 4 % | 28 % | 3.1–3.4 |
| 4 Leadership and Stewardship | 3 % | 3 % | 3 % | 4.2 |
| 5 Professionalism | 13 % | 12 % | 14 % | 5.1, 5.2, 5.4, 5.5 |

Les 20 compétences restent présentes dans l'inventaire, y compris sans concept rattaché. `HIGH-YIELD` ne filtre ni les compétences obligatoires ni les poids officiels. Les compteurs `mappedConcepts` et `publishedConcepts` sont éditoriaux, sans mesure de performance ou de maîtrise apprenant. Le pilote a zéro concept publié. Ses mappings sont des propositions éditoriales, pas une homologation PEBC.

## Catalogue pilote et graphe

Les UUID commencent par `90000000-0000-4000-8000-` ; les suffixes ci-dessous identifient les concepts de version 1. Ils sont enregistrés explicitement et ne doivent pas être réaffectés à d'autres concepts.

| Suffixe | Concept DRAFT | Priorité | Compétences |
|---|---|---|---|
| 000000000001 | Neurotransmission : prérequis du raisonnement | CORE | 2.2 |
| 000000000002 | Mécanismes des antiépileptiques : liens à expliquer | CORE | 2.2 |
| 000000000003 | Évaluation : recueillir les données pertinentes | CORE | 1.1, 1.2 |
| 000000000004 | Principes de choix et de suivi du traitement | HIGH-YIELD | 1.3, 1.5 |
| 000000000005 | Sécurité : modification du traitement et conseil | CORE | 3.1, 5.5 |
| 000000000006 | Concomitants : analyse des risques à vérifier | SECONDARY | 1.2, 5.5 |
| 000000000007 | Contextes particuliers : limites et données manquantes | ADVANCED | 1.2, 2.2 |

Prérequis proposés : 1 → 2, 2 → 4, 3 → 4, 3 → 5, 4 → 7. Le concept 6 est volontairement sans arête dans cette première proposition. Ce graphe éditorial ne déclenche aucune adaptation.

Chaque concept possède des emplacements chapitre, objectif, source, question, cas et flashcard. Les identifiants natifs du pilote restent nuls tant que le rattachement n'est pas vérifié. `SNC-V4-009` est seulement un candidat éditorial pour le concept 5, jamais un identifiant natif inventé.

| Mapping | Réutilisation native |
|---|---|
| Domaine/compétence PEBC | Catégorie officielle dérivée du code de compétence dans la version du blueprint |
| Learning objective | `learning_objectives`, version du curriculum propriétaire |
| Chapitre | `curriculum_units`, version du curriculum propriétaire |
| Source | `source_versions`, identifiant de version exact ; source courante READY et extraction COMPLETED à l'import |
| Question | `mcq_question_versions`, item + numéro de version |
| Cas | `osce_station_versions`, identifiant et numéro de version |
| Flashcard | Emplacement typé ; rattachement différé car les cartes personnelles actuelles n'ont pas de version immuable |

Le statut READY/extraction COMPLETED d'une source ne vaut pas approbation clinique. Les contenus devront suivre les validations éditoriales existantes avant toute publication. Les sessions du coach ne sont pas détournées en catalogue de cas.

## Flags et accès

`MENTOR_MLE_CATALOG_ENABLED` est OFF si absent. Seule la valeur exacte `1` active la route ; aucune configuration d'environnement n'est activée par ce lot. OFF renvoie 404 sans lire l'identité ni la base. ON impose une session Auth0 dont le sujet appartient à l'allowlist opérateur existante `pilot.provisionerSubjects`. Une activation de production exige une autorisation distincte. Aucun rôle éditorial parallèle n'est ajouté.

## Vérification

Les commandes utilisent Node 24+ et les exécutables déjà installés dans `node_modules`. Les variables des vérifications pointent vers des répertoires temporaires synthétiques ; le flag MLE et les données de démonstration restent désactivés pour le build.

| Quality gate | Résultat |
|---|---|
| `node node_modules/typescript/bin/tsc --noEmit` | PASS, code 0 |
| `node node_modules/eslint/bin/eslint.js .` | PASS, code 0, aucun diagnostic |
| `node node_modules/vitest/vitest.mjs run --maxWorkers=2` | PASS : 145 fichiers, 679 tests réussis, 1 test optionnel ignoré sur 680 ; 177,88 s |
| Nouveaux tests MLE | 18 tests réussis : domaine 5, intégration SQLite 8, API 3, migration 2 |
| Migration / non-régression | Incluses dans la suite complète : historique conservé, schémas antérieurs, activation explicite, sauvegarde/restauration, démarrage, imports, Foundation, QCM, OSCE, isolation apprenant |
| `node node_modules/next/dist/bin/next build` | PASS, compilation, TypeScript et génération des 22 pages statiques ; route MLE dynamique |
| Prévisualisation synthétique | PASS : 7 concepts DRAFT, 5 prérequis, 20 compétences, zéro publication |

Le test ignoré est le test OCR local conditionnel préexistant de `local-pdf-ocr.test.ts`, dont la fixture externe n'est pas disponible. Aucun test n'est supprimé ou nouvellement désactivé ; les seuils de délai ne sont pas relevés. Les attentes de version courante passent à 18 et les registres des scénarios historiques sont bornés explicitement. Les fixtures de sauvegarde déclarent maintenant la version réellement créée. Deux fixtures temporaires de MIG-0017 utilisent `synchronous=OFF` uniquement lors de leur construction pour éviter les dépassements dus aux synchronisations disque ; leurs assertions de fichier, lecture seule et rejet d'un schéma falsifié sont conservées. Ce réglage ne touche ni le code de production ni les tests de durabilité/rollback.

Les contrôles spécifiques couvrent aussi les imports atomiques, le refus de publication, les versions immuables, les références natives exactes et invalides, les cycles ajoutés dans des transactions distinctes, l'indépendance des priorités et de la couverture officielle, le flag OFF et l'autorisation avant lecture des brouillons. Le test des sources confirme que leur texte n'est pas copié dans le catalogue.

## Risques, limitations et dette technique

- Les sept concepts sont une proposition de structure à revoir par le responsable éditorial. Les 42 emplacements natifs sont en attente ; le pilote n'est pas publiable.
- Le repository gère une seule version de blueprint à la fois et refuse sa mutation. La coexistence de plusieurs éditions requerra un contrat explicite.
- Les flashcards personnelles ne sont pas résolues ; leur versionnement éditorial devra être conçu sans collecte supplémentaire de données apprenant. Les cas du coach nécessitent un catalogue natif stable s'ils doivent être référencés ultérieurement.
- L'immutabilité et l'acyclicité sont garanties par les services du catalogue ; un accès SQL direct peut contourner les règles applicatives. Les clés étrangères et contraintes de structure restent en base. Aucun trigger des migrations historiques n'est modifié.
- Les suppressions de ressources natives référencées sont bloquées par FK ; traiter une future suppression via archivage ou procédure éditoriale, jamais en cascade destructrice des concepts.
- Aucun contenu clinique n'est recopié. Le catalogue ne remplace pas la validation des sources au moment d'une utilisation clinique ultérieure.
- Le démarrage avec un ancien schéma doit suivre la procédure d'exploitation existante : l'ajout au registre ne constitue pas une autorisation de migrer Render.

## Rollback

1. Désactiver le flag ferme l'exposition sans supprimer les brouillons.
2. En cas d'échec pendant MIG-0018, la transaction annule les nouvelles tables, index et entrée d'historique ; les tests le vérifient.
3. Après migration réussie, ne pas supprimer les tables ou les entrées d'historique pour simuler une version 17. Conserver le schéma et désactiver l'exposition est le retour arrière fonctionnel privilégié.
4. Pour un retour complet à un binaire antérieur, restaurer une sauvegarde 17 vérifiée vers une nouvelle base de staging, contrôler son intégrité et les données, puis autoriser séparément la bascule. Un ancien binaire peut refuser le schéma 18. Toute donnée ajoutée depuis la sauvegarde exige une stratégie de conservation avant bascule. Aucune restauration de production n'est exécutée ici.

## Éléments explicitement non implémentés

Mastery Engine, Error Ledger complet, Review Scheduler, scoring de maîtrise, interleaving adaptatif, transfert adaptatif, dashboard MLE, collecte supplémentaire de données apprenant, nouveaux évaluateurs IA et calibration psychométrique. Les fonctions QCM, flashcards, coach, RAG, sources, citations, sécurité clinique, examens, Foundation, OSCE et analytics ne sont pas reconstruites.

## Recommandation LOT 10

Avant tout LOT 10 / MLE-02 : obtenir une autorisation explicite, vérifier les rattachements natifs et faire revoir le pilote par le responsable éditorial. Puis appliquer les conditions d'entrée de la feuille de route MLE validée. Ce lot n'apporte aucune preuve de validité psychométrique ou de maîtrise. **LOT 10 non commencé.**

## Fichiers créés et modifiés

Fichiers créés :

- `docs/reports/RAPPORT-LOT-9-MLE-01.md`
- `scripts/mle-catalog-preview.ts`
- `src/app/api/mle/catalog/catalog-handler.ts`
- `src/app/api/mle/catalog/route.test.ts`
- `src/app/api/mle/catalog/route.ts`
- `src/application/mle/catalog-ports.ts`
- `src/application/mle/catalog-use-cases.ts`
- `src/application/mle/pilot-catalog.ts`
- `src/domain/mle/catalog.test.ts`
- `src/domain/mle/catalog.ts`
- `src/infrastructure/database/sqlite/migrations/definitions/mig-0018-mle-concept-catalog.ts`
- `src/infrastructure/database/sqlite/migrations/mig-0018-mle-concept-catalog.test.ts`
- `src/infrastructure/mle/catalog-feature.ts`
- `src/infrastructure/mle/sqlite-catalog-repository.integration.test.ts`
- `src/infrastructure/mle/sqlite-catalog-repository.ts`
- `src/infrastructure/mle/sqlite-native-resources.ts`

Fichiers modifiés :

- `src/infrastructure/database/sqlite/activation/controlled-migration-activation.test.ts`
- `src/infrastructure/database/sqlite/activation/migration-operator-cli.test.ts`
- `src/infrastructure/database/sqlite/backup/sqlite-backup-service.test.ts`
- `src/infrastructure/database/sqlite/migrations/core-migration-registry.ts`
- `src/infrastructure/database/sqlite/migrations/database-readiness-orchestrator.test.ts`
- `src/infrastructure/database/sqlite/migrations/fresh-database-bootstrap.test.ts`
- `src/infrastructure/database/sqlite/migrations/fresh-database-bootstrap.ts`
- `src/infrastructure/database/sqlite/migrations/legacy-baseline-adopter.test.ts`
- `src/infrastructure/database/sqlite/migrations/mig-0003-source-model.test.ts`
- `src/infrastructure/database/sqlite/migrations/mig-0010-calculations-lab-core.test.ts`
- `src/infrastructure/database/sqlite/migrations/mig-0011-osce-text-core.test.ts`
- `src/infrastructure/database/sqlite/migrations/mig-0012-closed-web-pilot.test.ts`
- `src/infrastructure/database/sqlite/migrations/mig-0014-mcq-content-import.test.ts`
- `src/infrastructure/database/sqlite/migrations/mig-0015-source-version-editorial-alias.test.ts`
- `src/infrastructure/database/sqlite/migrations/mig-0016-learner-data-isolation.test.ts`
- `src/infrastructure/database/sqlite/migrations/mig-0017-mcq-session-specialization.test.ts`
- `src/infrastructure/database/sqlite/operational-schema-support.test.ts`
- `src/infrastructure/database/sqlite/preflight/database-migration-preflight.test.ts`
- `src/infrastructure/database/sqlite/preflight/database-migration-preflight.ts`
- `src/infrastructure/database/sqlite/server-database-startup.test.ts`

Les six documents de conception MLE préexistants et les autres fichiers non suivis présents au départ ne sont pas modifiés par ce lot.

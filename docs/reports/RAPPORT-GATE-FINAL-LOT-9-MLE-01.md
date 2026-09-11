# Gate final LOT 9 / MLE-01 — revue éditoriale et contractuelle

Date : 9 septembre 2026.

**Verdict global : NOT READY FOR LOT 10.** Les rattachements éditoriaux restent à qualifier. **MIGRATION_DECISION = MIG-0018 IMMUTABLE / CORRECTION ADDITIVE PAR MIG-0019.** La correction directe précédente est retirée suivant la dernière décision humaine ; voir **section 9** pour l'état courant. Aucun concept n'est publié, aucun rattachement éditorial n'est appliqué et LOT 10 n'est pas commencé.

Les sections 1 à 7 conservent la revue initiale du commit `4cafa638fae1781c3515974235ebd1cb665cb114`. La section 8 conserve la trace de la correction locale `21286202d42579e31bfb1d26f47429d8193fd5b3`, refusée au gate et non poussée. **La section 9 remplace les décisions de migration et les résultats techniques antérieurs.** Les dix propositions de rattachement restent inchangées.

## 1. Périmètre, preuves et limites de l'inventaire

Commit examiné : [4cafa638fae1781c3515974235ebd1cb665cb114](https://github.com/arnaudotchoumouhme-byte/mentor-platform/commit/4cafa638fae1781c3515974235ebd1cb665cb114), branche `codex/lot-9-mle-01`. HEAD correspond à ce SHA ; la comparaison des fichiers de code, scripts et contenu suivis avec ce commit ne montre aucune différence. Ce gate ajoute seulement le présent rapport local, sans modifier le code accepté, sans commit/push supplémentaire.

L'inventaire distingue **définition versionnée**, **import historiquement documenté**, **fichier source vérifié aujourd'hui** et **présence actuelle en base**. Aucun accès Render, aucune ouverture de base de production, aucune lecture ou modification de données apprenant. Les chemins temporaires cités dans les rapports DEV-003/DEV-003A ont été testés pour leur existence uniquement : `mentor-local-preview-recovery/mentor-staging-v14.db` et `mentor-local-preview/mentor.db` ne sont plus présents. Aucune base n'a été recréée ou restaurée. `data/mentor.db` et les backups protégés n'ont pas été ouverts.

Par conséquent, les candidats ci-dessous ne constituent pas un inventaire SQL actuel exhaustif. Une absence dans le dépôt n'est pas une preuve d'absence dans une base non consultée. **Aucun rattachement n'obtient VALIDÉ** dans ce gate.

### Références des preuves

Les liens GitHub ci-dessous sont figés au commit accepté.

| Preuve | Ressource examinée | Ce qu'elle établit |
|---|---|---|
| P1 | [pilot-catalog.ts](https://github.com/arnaudotchoumouhme-byte/mentor-platform/blob/4cafa638fae1781c3515974235ebd1cb665cb114/src/application/mle/pilot-catalog.ts) | Sept UUID explicites, version 1, DRAFT, 42 emplacements sans cible, cinq prérequis |
| P2 | [foundation-curriculum-seed.ts](https://github.com/arnaudotchoumouhme-byte/mentor-platform/blob/4cafa638fae1781c3515974235ebd1cb665cb114/src/application/foundation/foundation-curriculum-seed.ts) | Six unités et six objectifs de démonstration technique, non cliniques |
| P3 | [Corpus publié SNC](https://github.com/arnaudotchoumouhme-byte/mentor-platform/blob/4cafa638fae1781c3515974235ebd1cb665cb114/docs/content/SNC-QCM-PILOT-V4-PUBLISHED.mcq-corpus.json) | Dix identités SNC-001 à SNC-010, versions 2, statut PUBLISHED dans le fichier, source UUID et mappings |
| P4 | [Mapping publié](https://github.com/arnaudotchoumouhme-byte/mentor-platform/blob/4cafa638fae1781c3515974235ebd1cb665cb114/docs/content/SNC-QCM-PILOT-V4-PUBLISHED-MAPPING.md) et [mapping V1](https://github.com/arnaudotchoumouhme-byte/mentor-platform/blob/4cafa638fae1781c3515974235ebd1cb665cb114/docs/content/SNC-QCM-PILOT-V4-V1-IMPORTABLE-MAPPING.md) | Résolution historique de l'alias source vers UUID, numéro 1 et checksum |
| P5 | [DEV-003, section H](https://github.com/arnaudotchoumouhme-byte/mentor-platform/blob/4cafa638fae1781c3515974235ebd1cb665cb114/docs/reports/DEV-003-SNC-MCQ-IMPORT.md) | Import historique staging : dix versions 1 puis dix versions 2 ; ne pas confondre avec l'échec antérieur de la section F |
| P6 | [Revue éditoriale SNC](https://github.com/arnaudotchoumouhme-byte/mentor-platform/blob/4cafa638fae1781c3515974235ebd1cb665cb114/docs/content/SNC-QCM-PILOT-V4-EDITORIAL-SAFETY-REVIEW.md) | Revue documentaire antérieure, référence PEBC 01-2026, pas une validation nouvelle du catalogue MLE |
| P7 | PDF local `content-sources/COMPREHENSION COURS PEBC/SYSTÈME NERVEUX CENTRAL.pdf` | 49 pages ; SHA-256 vérifié, identique à P4 ; lecture textuelle et visuelle des pages 4, 40, 41, 42, 43, 46 et 49 |
| P8 | [Résolveur natif](https://github.com/arnaudotchoumouhme-byte/mentor-platform/blob/4cafa638fae1781c3515974235ebd1cb665cb114/src/infrastructure/mle/sqlite-native-resources.ts), [tests SQLite](https://github.com/arnaudotchoumouhme-byte/mentor-platform/blob/4cafa638fae1781c3515974235ebd1cb665cb114/src/infrastructure/mle/sqlite-catalog-repository.integration.test.ts) | Contrat SOURCE effectivement codé et testé |
| P9 | [MIG-0018](https://github.com/arnaudotchoumouhme-byte/mentor-platform/blob/4cafa638fae1781c3515974235ebd1cb665cb114/src/infrastructure/database/sqlite/migrations/definitions/mig-0018-mle-concept-catalog.ts), [MIG-0003](https://github.com/arnaudotchoumouhme-byte/mentor-platform/blob/4cafa638fae1781c3515974235ebd1cb665cb114/src/infrastructure/database/sqlite/migrations/definitions/mig-0003-source-model.ts) | Contraintes des références MLE et identité native source/version |
| P10 | [Repository OSCE](https://github.com/arnaudotchoumouhme-byte/mentor-platform/blob/4cafa638fae1781c3515974235ebd1cb665cb114/src/infrastructure/osce/sqlite-osce-repository.ts), [cas coach synthétique](https://github.com/arnaudotchoumouhme-byte/mentor-platform/blob/4cafa638fae1781c3515974235ebd1cb665cb114/src/application/coach/synthetic-case-catalog.ts) | Infrastructure de stations ; cas coach distinct d'une station OSCE |
| P11 | [Domaine MLE](https://github.com/arnaudotchoumouhme-byte/mentor-platform/blob/4cafa638fae1781c3515974235ebd1cb665cb114/src/domain/mle/catalog.ts), [rapport LOT 9](https://github.com/arnaudotchoumouhme-byte/mentor-platform/blob/4cafa638fae1781c3515974235ebd1cb665cb114/docs/reports/RAPPORT-LOT-9-MLE-01.md) | Couverture éditoriale, priorités indépendantes, limitations et gates techniques antérieurs |
| P12 | Document local préexistant `docs/reports/MLE-USER-JOURNEY.md`, section pilote | Les neuf fonctions à éprouver ; document non suivi dans le commit accepté, utilisé comme contexte de conception validé dans la conversation |

SHA-256 du PDF P7 : `1e194e6192ea11b3f8a33fce78fdd4ffa332b83f1f9b38e1836b57fdac39c273`. Cette identité de fichier ne certifie ni son actualité clinique ni la disponibilité actuelle de sa ligne SQL. Les autres PDF SNC présents localement ne sont pas assimilés à cet UUID.

## 2. Inventaire des ressources natives candidates

### Identités et conventions

C1 à C7 sont uniquement des abréviations de lecture du rapport, pas de nouveaux identifiants applicatifs. Leurs UUID sont respectivement `90000000-0000-4000-8000-000000000001` à `90000000-0000-4000-8000-000000000007`, tous en version 1 et DRAFT.

S1 désigne la source historique du PDF P7 : `source_version_id = 8fdf1a28-6025-4846-a74b-1b4faca1d98f`, numéro de version native **1**, alias documentaire `SNC-COURS-2026-04-28/V1`. **Le `source_id` parent n'est pas établi par les preuves consultées** : il reste inconnu et ne sera pas déduit de l'alias, du nom de fichier ou du checksum.

Dans les matrices : **PROPOSÉ** = compatibilité de sujet étayée, limitée au périmètre indiqué, avec contrôle natif/éditorial restant ; **VALIDÉ** = identité actuelle, version, contenu et approbation du rattachement démontrés ; **REJETÉ** = ne pas utiliser ce candidat pour ce lien. « Aucun candidat démontré » n'est pas un verdict de suppression ou d'inexistence globale. Tous les emplacements du pilote restent nuls.

### Learning Objectives et curriculum_units réellement examinés

Le seul seed Foundation trouvé définit des unités « Structure technique … » et l'objectif « Identifier la structure technique de démonstration de ce bloc ». Tous sont DRAFT ; les objectifs sont de type `TECHNICAL_SEED`. Curriculum : `f0000001-0000-4000-8000-000000000001`, numéro **1**, date d'effet technique **2027-01-01**. Ce n'est pas un chapitre d'épilepsie.

| Bloc | curriculum_unit ID | Learning Objective ID | Version cible commune | Statut pour le pilote |
|---|---|---|---|---|
| BIO | f0000001-0000-4200-8000-000000000001 | f0000001-0000-4300-8000-000000000001 | f0000001-0000-4000-8000-000000000001 | REJETÉ |
| PHA | f0000001-0000-4200-8000-000000000002 | f0000001-0000-4300-8000-000000000002 | même curriculum | REJETÉ |
| CALC | f0000001-0000-4200-8000-000000000003 | f0000001-0000-4300-8000-000000000003 | même curriculum | REJETÉ |
| THER | f0000001-0000-4200-8000-000000000004 | f0000001-0000-4300-8000-000000000004 | même curriculum | REJETÉ |
| CAN | f0000001-0000-4200-8000-000000000005 | f0000001-0000-4300-8000-000000000005 | même curriculum | REJETÉ |
| COMM | f0000001-0000-4200-8000-000000000006 | f0000001-0000-4300-8000-000000000006 | même curriculum | REJETÉ |

Ces UUID sont dérivés exactement de la fonction déterministe du seed existant P2 ; ils ne sont ni créés ni présentés comme des lignes SQL actuellement présentes. Les codes `SNC-002-OA-01` et `SNC-009-OA-01` existent dans les mappings QCM P3, mais ne prouvent pas l'existence d'un `learning_objectives.learning_objective_id`. Leur chaîne est un tag éditorial, pas une FK Foundation vérifiée.

### Matrice concept → ressource → identité/version → preuve → statut

Les références BIO/PHA/THER/COMM renvoient aux identités exactes du tableau précédent. La colonne ID « — » signifie non établi, jamais un identifiant à importer.

| Concept | Famille / ressource candidate | ID | Version | Justification et limite | Preuve disponible | Statut |
|---|---|---|---|---|---|---|
| C1 Neurotransmission | LO BIO ; tag QCM SNC-002-OA-01 | LO BIO ci-dessus ; tag SNC-002-OA-01 | Curriculum 1 ; tag dans SNC-002/2 | Seed purement technique ; tag non démontré comme LO natif | P2, P3 | REJETÉ |
| C1 | CHAPTER BIO | Unité BIO ci-dessus | Curriculum 1 | Aucun enseignement clinique dans ce seed | P2 | REJETÉ |
| C1 | SOURCE équilibre excitation/inhibition | S1 : 8fdf1a28-6025-4846-a74b-1b4faca1d98f | 1 | Portion de source pertinente, pas validation générale du document | P4, P5, P7 p. 4 et 40, Q147–150 | PROPOSÉ |
| C1 | QUESTION neurotransmission | SNC-002 | 2 | Reconnaissance d'un principe ; pas preuve de rappel libre | P3, P5, P6 ; mapping 2.2 | PROPOSÉ |
| C1 | CASE station OSCE | — | — | Aucune station épilepsie démontrée | P10, recherche des définitions hors tests | REJETÉ |
| C2 Mécanismes | LO PHA ; tag SNC-002-OA-01 | LO PHA ci-dessus ; tag SNC-002-OA-01 | Curriculum 1 ; tag dans SNC-002/2 | Aucun LO natif causal compatible démontré | P2, P3 | REJETÉ |
| C2 | CHAPTER PHA | Unité PHA ci-dessus | Curriculum 1 | Bloc technique, pas unité mécanismes | P2 | REJETÉ |
| C2 | SOURCE mécanismes | S1 : 8fdf1a28-6025-4846-a74b-1b4faca1d98f | 1 | Sections à circonscrire et relire ; ne pas généraliser un mécanisme à toute la classe | P7 p. 40–43 ; P6 pour le sous-thème SNC-002 | PROPOSÉ |
| C2 | QUESTION neurotransmission | SNC-002 | 2 | Candidat secondaire pour le seul sous-thème GABA ; insuffisant pour tous les mécanismes | P3, P5, P6 | PROPOSÉ |
| C2 | CASE station OSCE | — | — | Aucune station compatible démontrée | P10 | REJETÉ |
| C3 Évaluation | LO THER | LO THER ci-dessus | Curriculum 1 | Objectif technique, aucune collecte clinique spécifiée | P2 | REJETÉ |
| C3 | CHAPTER THER | Unité THER ci-dessus | Curriculum 1 | Pas de chapitre d'évaluation clinique | P2 | REJETÉ |
| C3 | SOURCE vérifications d'ordonnance | S1 : 8fdf1a28-6025-4846-a74b-1b4faca1d98f | 1 | Appui partiel : vérifications générales SNC ; ne remplace pas une anamnèse épilepsie | P7 p. 49, Q200 | PROPOSÉ |
| C3 | QUESTION SNC-009 envisagée | SNC-009 | 2 | Le stem ne teste pas la collecte des données pertinentes ; ne pas le compter comme évaluation complète | P3 | REJETÉ |
| C3 | CASE station OSCE | — | — | Aucun scénario de recueil épilepsie démontré | P10 | REJETÉ |
| C4 Choix et suivi | LO THER | LO THER ci-dessus | Curriculum 1 | Aucun LO natif de décision/monitoring compatible démontré | P2 | REJETÉ |
| C4 | CHAPTER THER | Unité THER ci-dessus | Curriculum 1 | Contenu technique seulement | P2 | REJETÉ |
| C4 | SOURCE choix/surveillance, extraits candidats | S1 : 8fdf1a28-6025-4846-a74b-1b4faca1d98f | 1 | Mentions pertinentes ; absence de protocole complet et de validation de toutes ces sections | P7 p. 42 Q156/Q159, p. 43 Q161/Q164, p. 46 Q181 | PROPOSÉ |
| C4 | QUESTION SNC-009 envisagée | SNC-009 | 2 | Conseil ponctuel, pas comparaison thérapeutique ni adaptation d'un suivi | P3 | REJETÉ |
| C4 | CASE station OSCE | — | — | Aucun cas de décision suivi qualifié démontré | P10 | REJETÉ |
| C5 Sécurité/conseil | LO COMM ; tag SNC-009-OA-01 | LO COMM ci-dessus ; tag SNC-009-OA-01 | Curriculum 1 ; tag dans SNC-009/2 | Le tag ne devient pas un LO natif et le seed n'enseigne pas le conseil | P2, P3 | REJETÉ |
| C5 | CHAPTER COMM/THER | Unités COMM/THER ci-dessus | Curriculum 1 | Structures techniques, non cliniques | P2 | REJETÉ |
| C5 | SOURCE conseil | S1 : 8fdf1a28-6025-4846-a74b-1b4faca1d98f | 1 | Correspondance documentaire directe sur un périmètre borné | P7 p. 46 Q181–183 ; P6 ; P4/P5 | PROPOSÉ |
| C5 | QUESTION modification du traitement | SNC-009 | 2 | Meilleur candidat direct ; arbitrage du mapping 1.4 versus 3.1/5.5 requis | P3, P5, P6 | PROPOSÉ |
| C5 | CASE station OSCE | — | — | Un QCM avec vignette n'est pas une station OSCE | P3, P10 | REJETÉ |
| C6 Concomitants | LO THER | LO THER ci-dessus | Curriculum 1 | Aucun LO natif d'analyse d'interactions démontré | P2 | REJETÉ |
| C6 | CHAPTER THER | Unité THER ci-dessus | Curriculum 1 | Simple seed technique | P2 | REJETÉ |
| C6 | SOURCE interactions/vérifications | S1 : 8fdf1a28-6025-4846-a74b-1b4faca1d98f | 1 | Sujet présent, mais la revue de SNC-002/009 ne valide pas ces autres sections | P7 p. 41 Q154 et p. 49 Q200 | PROPOSÉ |
| C6 | QUESTION du corpus SNC | — | — | Les dix stems ne démontrent pas un item ciblé d'interactions antiépileptiques ; ne pas recycler un autre thème SNC | P3, revue des dix items | REJETÉ |
| C6 | CASE station OSCE / cas coach | case-safety-1 (coach seulement) | 1 | Cas générique hors épilepsie et hors table osce_station_versions | P10 | REJETÉ |
| C7 Contextes particuliers | LO THER | LO THER ci-dessus | Curriculum 1 | Aucun LO contextualisé compatible démontré | P2 | REJETÉ |
| C7 | CHAPTER THER | Unité THER ci-dessus | Curriculum 1 | Aucun chapitre spécialisé clinique | P2 | REJETÉ |
| C7 | SOURCE contexte particulier | S1 : 8fdf1a28-6025-4846-a74b-1b4faca1d98f | 1 | Un sous-thème repéré, aucune couverture de tous les contextes ; revue spécialisée requise | P7 p. 43 Q165 | PROPOSÉ |
| C7 | QUESTION du corpus SNC | — | — | Aucun des dix items ne teste ce contexte particulier | P3 | REJETÉ |
| C7 | CASE station OSCE | — | — | Aucune version native compatible démontrée | P10 | REJETÉ |

Bilan : **10 propositions de liens** (sept portions de la même source et trois associations concept/QCM portant sur deux items distincts), **zéro rattachement validé ou écrit**. Les versions 1 des deux QCM, historiquement IN_REVIEW, restent des antécédents documentés et ne sont pas préférées à leurs versions 2. Partager SNC-002/2 entre C1 et C2 ne crée pas deux observations indépendantes.

Les fixtures OSCE et MLE des tests ne sont pas des contenus éditoriaux utilisables. Aucune station compatible ne peut être nommée sur la seule présence du repository. Les flashcards personnelles non versionnées restent hors rattachement ; aucune donnée personnelle n'a été consultée.

## 3. Contrat SOURCE : audit et recommandation avant décision

### Constat volontaire, mais contrat à clarifier

P8 compare deux fois `v.source_version_id` avec `targetId` et `targetVersion`. Le test introduit explicitement la paire `source-v1/source-v1`, attend son acceptation et rejette `source-v1/source-v2`. Le rapport LOT 9 décrit également l'identifiant de version exact. **Le comportement est donc un contrat effectivement choisi et testé, pas une simple faute SQL isolée.** Aucune justification architecturale autonome ne démontre toutefois pourquoi cette duplication devrait rester canonique.

Les deux paramètres doivent désigner la même ligne. `targetVersion` n'apporte aucune identité supplémentaire ; un numéro `1` y serait rejeté. La colonne générée `mle_resource_links.source_version_id` prend **target_id**, et sa FK pointe vers `source_versions.source_version_id` : une modification du résolveur seule serait incompatible avec le schéma 18.

| Famille | targetId actuel | targetVersion actuel | Lecture du contrat |
|---|---|---|---|
| CHAPTER | unit_id | curriculum_version_id | Version du conteneur, pas version indépendante de l'unité ; stabilité inter-éditions à documenter |
| LEARNING_OBJECTIVE | learning_objective_id | curriculum_version_id | Même distinction entre identité de l'objectif et édition du curriculum |
| QUESTION | item_id | numéro version, texte canonique | Identité stable + révision exacte, conforme à la préférence |
| CASE | station_version_id | numéro version | Déjà une identité de révision ; ce n'est pas le station_id stable. Dette de cohérence distincte |
| SOURCE | source_version_id | même source_version_id | Identité de révision dupliquée ; identité parent absente du lien |

Autre anomalie : `s.version=v.version` n'autorise que la version courante. Après passage de la source à V2, un lien exact V1 devient non résolvable même si V1 existe encore. Cela mélange **résolution historique** et **éligibilité clinique actuelle**. Le test SOURCE couvre DELETED et une mauvaise paire, mais pas ce changement de version courante. La lecture du repository MLE ne revalide pas chaque source via ce résolveur : un lien enregistré peut encore apparaître dans le catalogue après changement d'état natif. Sa présence ne doit donc jamais signifier « utilisable cliniquement maintenant ».

### Décision recommandée, non encore autorisée

**Retenir comme contrat canonique proposé : `targetId = sources.source_id` et `targetVersion = source_versions.source_version_id`.** Le numéro `source_versions.version` et le checksum restent des métadonnées explicites de la version ; ne pas utiliser l'alias éditorial, une date, le nom du PDF ou son checksum comme substitut de FK.

La résolution doit prouver que la version exacte existe **et appartient au source_id fourni**. Le parent ne doit pas être deviné à l'import. Pour S1, il reste à obtenir depuis une source de preuve autorisée.

Deux responsabilités devront être distinguées après décision :

1. Résolution historique exacte : identité parent/version et intégrité du contenu ; aucune substitution automatique par la dernière version. Une ancienne version conservée peut être retrouvée pour la traçabilité.
2. Autorisation d'usage clinique : contrôles natifs existants, statut actuel, retrait éventuel, revue éditoriale et citations. Une version retraçable peut être inéligible à un nouvel usage. READY et COMPLETED ne sont pas des signatures de validation clinique. Ne pas affaiblir les filtres RAG existants.

Un UUID exact ne suffit pas, à lui seul, à interdire toute mutation SQL du texte. Le contrat de conservation, le checksum et les politiques de suppression natives doivent rester documentés. Les métadonnées techniques d'indexation peuvent évoluer sans devenir une nouvelle édition clinique.

### Conséquences de migration à arbitrer

**Aucune migration créée ni exécutée ici. Aucun numéro futur attribué. MIG-0018 reste immuable.** Même si le seed n'a aucun lien résolu, on ne peut pas conclure que toutes les bases ayant reçu le schéma 18 sont vides.

Option recommandée si le changement est autorisé : évolution additive avec un contrat de référence SOURCE explicitement versionné, par exemple une table dédiée V2, conservant les anciennes lignes V1. La nouvelle structure porterait l'identité du concept/version/lien, source_id, source_version_id, provenance de conversion et timestamp. Des FK et une contrainte d'appartenance parent/version seraient nécessaires ; une FK séparée sur chaque ID ne suffit pas à empêcher une mauvaise paire. Selon le schéma retenu, un index UNIQUE additif sur le couple natif peut être requis. Ce choix détaillé reste à valider.

Plan de conversion proposé :

- Inventorier les lignes SOURCE non nulles dans un environnement autorisé ; vérifier le registre réel et le prochain numéro disponible avant toute migration.
- Pour chaque ancienne paire identique, retrouver son parent dans source_versions ; conserver l'ancienne référence et écrire une projection V2 traçable. Bloquer les orphelins, les paires divergentes ou les preuves incohérentes ; ne rien « réparer » par approximation.
- Ne pas réécrire les versions conceptuelles existantes. Une véritable modification éditoriale du rattachement doit créer une nouvelle version ; une conversion technique équivalente doit être identifiée comme telle, avec l'origine conservée.
- Maintenir temporairement un lecteur explicite V1/V2 ; ne pas inférer silencieusement la sémantique par la forme d'un UUID. Définir la version du DTO avant de changer l'API ou les imports.
- Tester appartenance parent/version, versions anciennes, source retirée, conservation du checksum et des localisateurs, reprise/idempotence, rollback, et absence de copie du contenu clinique.
- Retour arrière fonctionnel : flag OFF et conservation du schéma additif ; un binaire antérieur peut refuser un numéro de schéma supérieur. Un retour complet exige sauvegarde vérifiée et restauration contrôlée sur staging avant toute bascule séparément autorisée.

Alternatives non retenues par défaut : conserver la duplication avec une documentation plus claire (moins de migration, mais préférence architecturale non satisfaite) ; utiliser source_id + numéro entier (possible grâce à UNIQUE(source_id,version), mais moins directement aligné sur les références de versions/citations existantes). **L'arbitrage final appartient à l'utilisateur ; ce rapport ne l'active pas.**

## 4. Revue éditoriale des sept concepts DRAFT

| Concept | Granularité, chevauchements et lacunes | Compétences proposées : revue | Priorité : recommandation à arbitrer |
|---|---|---|---|
| C1 Neurotransmission | Acceptable si limité au prérequis excitation/inhibition. Définir une restitution observable ; éviter de recouvrir tous les mécanismes de C2 | 2.2 : soutien partiel, pas preuve complète du jugement professionnel | CORE cohérent comme prérequis |
| C2 Mécanismes | Trop vaste sans liste de mécanismes et limites. Définir l'explication causale attendue, séparée du simple vocabulaire C1 | 2.2 : soutien partiel ; SNC-002 ne suffit pas pour toute la cible | CORE pour le socle ; détails à borner, sans nouveau concept créé ici |
| C3 Évaluation | Titre transversal peu spécifique au chapitre. Distinguer données à recueillir, analyse et besoin de données supplémentaires. Chevauchement avec C6/C7 à préciser | 1.1/1.2 plausibles ; aucun LO natif ni scénario complet ne les opérationnalise | CORE cohérent |
| C4 Choix et suivi | Deux résultats différents regroupés : choix/plan puis monitoring/révision. Scinder ultérieurement ou définir deux sous-objectifs explicites | 1.3/1.5 plausibles ; aucune question candidate ne couvre le tout | Réexaminer HIGH-YIELD : un socle indispensable de choix/suivi devrait être CORE ; aucune fréquence d'examen démontrée |
| C5 Sécurité/conseil | Le titre mélange sécurité générale et acte de conseil. SNC-009 couvre une portion étroite, pas tous les risques | P3 rattache SNC-009 à 1.4 ; le concept porte 3.1/5.5. Multi-mapping possible, mais justification observable et ajout éventuel de 1.4 à arbitrer, jamais déduit automatiquement | CORE cohérent |
| C6 Concomitants | Chevauche C3 pour le recueil et C5 pour la sécurité. Définir ici l'analyse des concomitants et ses limites, pas toute l'évaluation | 1.2 plausible ; 5.5 ne se réduit pas à réussir un QCM d'interaction | SECONDARY à revoir : distinguer repérage de base CORE et analyses avancées. Priorité actuelle insuffisamment justifiée |
| C7 Contextes particuliers | Trop indéterminé : lister les contextes inclus/exclus et la réponse à des données manquantes. Chevauche C3/C6 | 1.2/2.2 plausibles mais non démontrées par une activité qualifiée | ADVANCED seulement pour la complexité ; les éléments essentiels de sécurité ne doivent pas être relégués globalement |

**Doublons exacts : PASS** (identités et titres distincts). **Absence de chevauchements sémantiques non maîtrisés : FAIL** (C1/C2, C3/C6/C7, C4/C5). Ces observations n'autorisent ni fusion ni suppression des UUID existants.

### Ordre logique et prérequis

Graphe actuel : C1→C2, C2→C4, C3→C4, C3→C5, C4→C7. Les cinq arêtes sont cohérentes comme proposition générale, sans cycle ; un ordre compatible est C1, C2, C3, C4, C5, C6, C7. Cet ordre n'est pas une séquence imposée par le moteur.

Le graphe ne contraint pas C6 et ne relie pas son analyse au choix/suivi C4. Propositions à revoir éditorialement : C3→C6 pour partir des données pertinentes ; C6→C4 si l'analyse des concomitants est effectivement nécessaire à la décision ciblée ; C5→C7 si les variantes avancées exigent ces acquis de sécurité. Avec les arêtes actuelles, ces propositions peuvent rester acycliques, mais **aucune n'est ajoutée**. Une simple association thématique ne justifie pas un prérequis obligatoire.

P1 fournit une provenance générique LOT 9, pas une justification spécifique de chaque arête. La preuve du prérequis et le périmètre d'évaluation devront être documentés. L'acyclicité technique ne valide pas l'ordre pédagogique.

### Couverture des neuf fonctions prévues

Contrôle de préparation éditoriale d'après P12, **pas demande d'implémenter les moteurs exclus de LOT 9**. Un FAIL ci-dessous signifie manque de contenu/contrat pour éprouver la fonction, sans révoquer l'acceptation technique.

| Fonction | Appui disponible | Manque pour le pilote | Préparation éditoriale |
|---|---|---|---|
| Diagnostic | C1/C3 ; SNC-002 candidat | LO, plan d'items et critères observables ; deux QCM ne forment pas un diagnostic | FAIL |
| Retrieval | Questions/réponses dans le PDF | Activités sans support, réponses attendues bornées, références et versions ; pas de flashcard native qualifiée | FAIL |
| Teach-back | C2, extraits mécanistiques | Consigne et rubrique causale relues ; distinction paraphrase/explication | FAIL |
| QCM | SNC-002/2 et SNC-009/2, historique P5 | Disponibilité native actuelle et approbation des liens MLE | PASS pour l'identification des candidats ; FAIL pour rattachement final |
| Cas | Intentions C3–C7 | Station/cas versionné spécifique, données suffisantes, divulgations et critères relus | FAIL |
| Error Ledger | Erreurs/distracteurs dans le corpus | Cibles d'erreur spécifiques aux concepts et action éditoriale ; moteur hors lot | FAIL |
| Maîtrise | Identités et graphe de concepts | Ensemble de preuves indépendantes et critères qualifiés ; aucun score à créer | FAIL |
| Révision | Cibles conceptuelles identifiées | Variantes de récupération distinctes ; scheduler hors lot | FAIL |
| Transfert | C6/C7 comme intentions | Variante pertinente et décision attendue relue, traçabilité de la famille ; pas de transfert adaptatif ici | FAIL |

Contenus manquants prioritaires : véritables LO et unité de chapitre, limites/critères des concepts, preuves des prérequis, scénarios et rubriques, activités de production indépendantes, compléments de sources cliniquement revus pour les sections proposées hors SNC-002/009. Les questions numérotées du PDF ne sont pas automatiquement des mcq_question_versions ou des flashcards.

## 5. Blueprint : confirmation au gate

Le [PDF officiel PEBC consulté pendant ce gate](https://pebc.ca/wp-content/uploads/pdfs/Qual%20EN/Pharmacist_Qualifying_Exam_Blueprint.pdf) affiche **03-2026**, applicable depuis **mai 2026**. P1 reste aligné sur cette référence. Les poids sont approximatifs selon PEBC.

| Catégorie | Total / QCM / OSCE (%) | Codes conservés |
|---|---|---|
| 1A | 45 / 50 / 40 | 1.1, 1.2, 1.3, 1.4, 1.5 |
| 1B | 14 / 20 / 8 | 1.6, 1.7, 1.8, 1.9, 1.10 |
| 2 | 9 / 11 / 7 | 2.2 |
| 3 | 16 / 4 / 28 | 3.1, 3.2, 3.3, 3.4 |
| 4 | 3 / 3 / 3 | 4.2 |
| 5 | 13 / 12 / 14 | 5.1, 5.2, 5.4, 5.5 |

Vingt codes distincts et trois totaux de 100 sont conservés. D'après le code P1/P11, sept codes ont un mapping conceptuel proposé : 1.1, 1.2, 1.3, 1.5, 2.2, 3.1, 5.5. Les treize autres restent dans l'inventaire obligatoire : 1.4, 1.6–1.10, 3.2–3.4, 4.2, 5.1, 5.2, 5.4. **Zéro concept publié ; aucune couverture complète du blueprint revendiquée.**

HIGH-YIELD ne filtre pas les compétences et ne modifie pas les poids dans P11. Sa justification éditoriale propre reste à établir. P6 citait 01-2026 : les codes candidats 2.2 et 1.4 existent dans 03-2026, mais cette concordance ne vaut pas revalidation complète du contenu ni du mapping MLE.

## 6. Tableau PASS/FAIL, anomalies et dette

| Contrôle | Résultat | Conséquence |
|---|---|---|
| Commit accepté et code inchangé | PASS | Revue rattachée exactement au SHA annoncé |
| Sept concepts, cinq familles natives examinées par concept | PASS | Matrice de 35 lignes et preuves explicitement qualifiées |
| Existence actuelle / versions natives confirmées pour tous les liens | FAIL | Bases temporaires documentées absentes ; aucune interrogation de production |
| LO et curriculum_unit cliniquement compatibles démontrés | FAIL | Seeds techniques rejetés ; tags QCM non convertis en FK |
| Candidats QCM et source historiquement identifiés | PASS | Deux items, une source avec checksum concordant ; pas de rattachement validé |
| Station OSCE épilepsie compatible démontrée | FAIL | Aucun candidat natif établi |
| DRAFT et absence de publication/rattachement | PASS | Aucun changement de données |
| Contrat SOURCE actuel compris | PASS | Duplication volontaire démontrée par code/test |
| Contrat SOURCE canonique et reproductibilité décidés | FAIL | Arbitrage et évolution additive éventuelle requis |
| Identités uniques / absence de cycle actuel | PASS | Ne prouve pas la validité pédagogique |
| Granularité, frontières et prérequis éditoriaux finalisés | FAIL | C4 composite ; C6 isolé ; frontières et justifications à préciser |
| Compétences et priorités éditorialement justifiées | FAIL | C5/1.4 à arbitrer ; priorités C4/C6/C7 non documentées |
| Neuf fonctions : assets suffisants pour les éprouver | FAIL | Lacunes explicites, sans exiger de moteur supplémentaire dans LOT 9 |
| PEBC 03-2026, 20 codes, séparation HIGH-YIELD | PASS | Aucun indicateur de couverture complète |
| Aucun Render, déploiement, migration, donnée apprenant ou LOT 10 | PASS | Analyse documentaire seulement |

Anomalies bloquantes du gate : **A1** contrat SOURCE redondant et résolution limitée à la version courante ; **A2** impossibilité de certifier la disponibilité native actuelle et source_id parent inconnu ; **A3** absence de LO/unité clinique et de station qualifiée ; **A4** périmètres/priorités/mapping C5 non arbitrés.

Dette à conserver explicitement : contrat CASE encore fondé sur l'ID de version ; stabilité inter-éditions Foundation à préciser ; localisateurs de source à porter via les citations existantes plutôt que seulement du texte libre ; immutabilité/conservation des contenus natifs à documenter ; rattachements multi-concepts à ne pas compter comme preuves indépendantes ; ancienne revue PEBC 01-2026 à rapprocher de 03-2026 ; absence de revue indépendante pharmacien signalée dans P4, non effacée par le statut PUBLISHED du corpus.

Les quality gates techniques du LOT 9 ne sont pas relancés : aucun fichier de code n'a changé et l'utilisateur a accepté leur résultat. Les contrôles exécutés ici sont lecture du code et des JSON/documents, comparaison Git, vérification d'existence des deux chemins temporaires, hash du PDF, extraction/inspection des pages pertinentes et consultation du blueprint officiel. Aucun état SQL actuel n'est présenté comme testé.

## 7. Conditions restantes et arrêt

1. Arbitrer explicitement SOURCE : contrat canonique proposé, version du contrat et séparation historique/usage clinique. Si un correctif est demandé, l'autoriser comme suivi LOT 9 avant tout travail dépendant ; aucune migration de production implicite.
2. Obtenir un inventaire éditorial en lecture seule depuis une staging autorisée ou un export sans données apprenant : identités, parents, versions, statuts, checksums et localisateurs. Confirmer S1 et les deux QCM sans inventer les identifiants manquants.
3. Faire approuver les frontières, prérequis, priorités et mappings des sept concepts ; identifier ou faire créer séparément les vrais LO/unité/cas manquants. La revue présente ne les crée pas.
4. Qualifier les liens proposés avec responsable, date et preuve. Conserver DRAFT pour toute validation manquante. Toute publication clinique requiert son autorisation éditoriale distincte.
5. Distinguer les assets nécessaires à l'étape suivante des neuf fonctions finales : ne pas implémenter prématurément les moteurs pour rendre ce tableau vert. Rendre explicites les dépendances restantes avant de déclarer le pilote prêt.

**Verdict final : NOT READY FOR LOT 10.** Ce verdict porte sur la sortie éditoriale et contractuelle demandée, pas sur les gates techniques déjà acceptés. Ce rapport ne constitue aucune autorisation de merge, push, déploiement, migration ou publication.

**STOP. Attendre exactement l'autorisation : « VALIDÉ — COMMENCE LOT 10 / MLE-02 ».** Aucune suite n'est démarrée.

## 8. Historique de la correction SOURCE retirée au gate (10 septembre 2026)

**Section historique uniquement : stratégie MIG-0018 modifiée annulée par la décision suivante. Ne pas appliquer les instructions de migration ci-dessous ; se référer à la section 9.**

### Décision humaine et vérifications préalables

L'utilisateur a explicitement confirmé que MIG-0018 est non historique : non mergée sur main, jamais appliquée à Render/production ou à une base persistante/partagée réelle, exécutée uniquement sur des bases synthétiques jetables et sans migration canonique ultérieure dépendante. L'absence de données MLE réelles et de besoin de backfill repose sur cette confirmation humaine et l'historique des opérations de cette tâche ; **ce n'est pas le résultat d'une interrogation de production**.

La définition de « migration historique » est précisée dans `docs/CODEX-GUARDRAILS.md` : merge canonique, application non éphémère ou dépendance canonique ultérieure suffisent à figer une migration. Le push d'une branche et les tests synthétiques ne suffisent pas. Cette décision autorise ici la correction de **MIG-0018 uniquement**, sans MIG-0019 et sans modifier MIG-0001 à MIG-0017.

Le schéma source existant a été vérifié dans MIG-0003 : `sources.source_id` est la clé primaire stable ; `source_versions.source_version_id` est la clé primaire de version ; `source_versions.source_id` référence `sources.source_id`, avec unicité `(source_id, version)`. Les usages SOURCE ont été examinés dans le modèle MLE, le seed, les use cases, le repository, le résolveur, MIG-0018 et les tests. Le seed conserve ses références nulles ; les couches génériques stockent déjà les deux champs sans les transformer.

### Contrat et contraintes corrigés

**SOURCE_CONTRACT : `targetId = source_id` ; `targetVersion = source_version_id`.**

- Le résolveur joint la version exacte à son parent et vérifie `s.source_id = targetId`, `v.source_version_id = targetVersion`, `s.status = READY` et `v.extraction_status = COMPLETED`.
- La condition `s.version = v.version` est supprimée. Une version antérieure explicitement désignée reste résolvable si les états requis sont satisfaits. Aucun numéro courant, version maximale ou remplacement implicite n'est utilisé.
- Le contrôle porte sur l'extraction de **la version demandée**. Une version plus récente COMPLETED ne compense pas l'extraction FAILED/REQUIRES_OCR de la cible.
- La disponibilité technique ne vaut toujours pas validation clinique. Les contrôles de publication, sources, RAG et citations existants ne sont pas modifiés. L'import reste exclusivement DRAFT et n'enregistre aucune approbation éditoriale.
- MIG-0018 génère maintenant `source_id` à partir de `target_id` et `source_version_id` à partir de `target_version` pour les liens SOURCE. Une FK vers `sources` et une FK composite vers `source_versions(source_id, source_version_id)` interdisent les mauvaises paires même en insertion SQL directe lorsque les FK sont activées.
- L'index UNIQUE additif `mle_source_versions_identity` sur le couple natif est nécessaire pour la FK composite SQLite. Il ne transforme aucun contenu natif. Les contraintes des cinq autres ResourceKind restent inchangées.

### Définition et checksum MIG-0018

Identité et transition inchangées : **MIG-0018, 17 → 18**. Le checksum canonique est calculé par le mécanisme existant `migrationChecksum`, à partir du DDL et du marqueur de postcondition mis à jour ; aucun hash d'historique réel n'est réécrit.

| Définition | SHA-256 canonique |
|---|---|
| Ancienne branche au commit 4cafa63 | `b4ce8d19a3f5cf6e8c148c4b62243e4b077898bf19b353451e1af16e41708d0b` |
| MIG-0018 corrigée | `32f72dae65c3d010e34bd95f9622e37084327c2239401692941b8346785b331f` |

Le validateur de schéma reconnaît aussi `CREATE UNIQUE INDEX` et vérifie la définition de ce nouvel index. Les tests vérifient le checksum enregistré, le refus de l'ancien checksum synthétique, le refus d'un index manquant et le rollback de l'index avec les nouvelles tables. La mutation de checksum dans ce test est exclusivement une simulation en mémoire de l'état périmé, pas une procédure de régularisation.

**Aucun backfill, aucune compatibilité silencieuse avec l'ancienne paire dupliquée.** Les tests construisent de nouvelles bases en mémoire. Toute ancienne base jetable au checksum précédent doit être recréée, pas migrée en falsifiant son historique. Si une application à une base réelle était ultérieurement découverte, arrêter : les prémisses de cette autorisation seraient invalidées.

Retour arrière de cette correction non déployée : revenir au commit antérieur sur une branche de travail et recréer uniquement les fixtures jetables correspondantes. Ne pas faire accepter alternativement deux checksums au runtime. Aucune suppression de base réelle ou de fichier historique n'est exécutée.

### Fichiers de la correction

| Fichier | Changement |
|---|---|
| `docs/CODEX-GUARDRAILS.md` | Définition courte du seuil d'immuabilité |
| `src/infrastructure/database/sqlite/migrations/definitions/mig-0018-mle-concept-catalog.ts` | Colonnes SOURCE, FK composite, index UNIQUE et matériau du checksum |
| `src/infrastructure/mle/sqlite-native-resources.ts` | Résolution exacte source stable/version immuable, états requis conservés |
| `src/infrastructure/mle/sqlite-catalog-repository.integration.test.ts` | Fixture SOURCE adaptée ; assertions historiques conservées |
| `src/infrastructure/mle/sqlite-source-contract.integration.test.ts` | Cas nominaux, mauvaises paires, états et versions antérieures, absence de copie et de promotion |
| `src/infrastructure/database/sqlite/migrations/mig-0018-mle-concept-catalog.test.ts` | Checksum canonique, refus d'un checksum périmé, index et rollback |
| `docs/reports/RAPPORT-GATE-FINAL-LOT-9-MLE-01.md` | Revue initiale conservée et présente correction documentée |

### Résultats de validation de la correction

| Contrôle obligatoire | Preuve de test | Résultat |
|---|---|---|
| Source correcte + version correcte | `resolves the exact version…`, V1 et V2 | PASS |
| Version appartenant à une autre source | Paire source-a / b-v1, résolveur et FK SQL | PASS |
| Source inexistante | Paire missing-source / a-v1 | PASS |
| Version inexistante | Paire source-a / missing-version | PASS |
| Source non READY | DELETED, FAILED et REQUIRES_OCR ; import annulé | PASS |
| Extraction cible non COMPLETED | FAILED et REQUIRES_OCR, même avec V2 complète | PASS |
| Aucune copie du contenu clinique | Relecture MLE sans contenu ; source_versions inchangée | PASS |
| Aucune version plus récente implicite | V1 conservée malgré version courante V2 ; aucune substitution si V1 invalide | PASS |
| DRAFT préservé | Statut DRAFT, reviewerId/reviewedAt nuls ; refus de publication antérieur conservé | PASS |
| Autres ResourceKind | Tests existants CHAPTER, LEARNING_OBJECTIVE, QUESTION, CASE et refus FLASHCARD non versionnée | PASS |
| Ancienne paire dupliquée et numéro seul refusés | a-v1 / a-v1 et source-a / 1, résolveur et SQL | PASS |
| Migration/checksum/rollback | Quatre tests MIG-0018 après séparation de l'idempotence, bootstrap et preflight | PASS en ciblé |

Commandes exécutées avec le Node fourni et les exécutables installés du dépôt, sans installation de dépendances :

| Gate | Commande / périmètre | Résultat |
|---|---|---|
| TARGETED_TESTS | `node node_modules/vitest/vitest.mjs run --maxWorkers=2` sur MLE, MIG-0018, bootstrap et preflight ; puis recontrôle de MIG-0018 réorganisé avec un worker | **55/55**, 7 fichiers, 25,27 s ; recontrôle **4/4**, 6,62 s |
| FULL_TESTS | Suite complète, nouvelle exécution avec `--maxWorkers=1` | Exécution complète forks : 693 PASS, 1 timeout, 1 ignoré (146 fichiers, 695 tests, 485,04 s). Précontrôle relancé isolément : 12/12 PASS, 17,60 s. Gate global NON VALIDÉ ; tentative threads interrompue sans résultat exploitable. |
| TYPECHECK | `node node_modules/typescript/bin/tsc --noEmit` | PASS, code 0 |
| LINT | `node node_modules/eslint/bin/eslint.js .` | PASS, code 0 |
| BUILD | Vérification Node puis `node node_modules/next/dist/bin/next build` | PASS, code 0 ; répertoire de données temporaire unique, MLE OFF, demo OFF |
| DIFF_REVIEW | Revue des requêtes, DDL/FK/index, checksum et périmètre ; `git diff --check` | PASS ; aucune modification des autres ResourceKind, du seed ou des migrations historiques |

La première suite complète avec deux workers, pendant les autres gates, a produit 692 réussites, un dépassement du délai de 5 secondes dans le test de préservation v17→v18, et un test OCR optionnel ignoré. Ce même test de migration avait réussi en ciblé. Une tentative avec un seul worker a reproduit le dépassement et a été interrompue. La préparation de la base v17 a ensuite été déplacée dans `beforeEach`, et les assertions d'idempotence/index séparées dans un quatrième test ; toutes les assertions initiales sont conservées. Le recontrôle des quatre tests a réussi, avant relance de la suite entière sans autre gate concurrent. Aucun délai n'a été relevé, aucune assertion ou exclusion affaiblie. Le test OCR conditionnel préexistant reste ignoré faute de fixture externe ; aucune nouvelle exclusion n'est introduite.

### Portée du résultat

Le blocage contractuel A1 est traité par la décision humaine et la correction décrite ici. Les conditions éditoriales A2/A3/A4 et les limites de preuve native de la revue initiale restent ouvertes. Les dix rattachements PROPOSÉS ne sont pas VALIDÉS ; aucun rattachement réel, concept publié, cas clinique ou mécanisme LOT 10 n'est créé.

**REAL_DB_TOUCHED : NON. DEPLOY : NON. LOT_10_STARTED : NON.** Aucun accès Render, `mentor.db`, migration réelle, changement apprenant, push ou merge. Arrêt à la remise de cette correction ; toute suite requiert une autorisation séparée.

### Clôture de la correction

La dernière suite complète terminée a validé les quatre tests MIG-0018 et les tests SOURCE. Elle a toutefois dépassé les 5 secondes dans le test préexistant `DatabaseMigrationPreflight > blocks an incompatible journal recorded as current` (environ 5,43 s), sans échec d'assertion rapporté. Résultat : 145 fichiers réussis et un fichier en échec, 693 tests réussis, un timeout et un test ignoré. Les 12 tests de ce fichier passent ensuite isolément, sans changement de code ni de délai. Cela est compatible avec une sensibilité au temps d'exécution, mais ne prouve pas que la suite entière est verte. Une dernière tentative `--pool=threads --maxWorkers=1` a été interrompue après plusieurs minutes sans aucun résultat de test exploitable ; elle ne compte pas comme une validation. Aucun test de précontrôle n'a été modifié.

| Champ demandé | Résultat final |
|---|---|
| STATUS | CORRECTION IMPLÉMENTÉE ; GATE GLOBAL NON VALIDÉ |
| FILES_CHANGED | Les sept fichiers listés ci-dessus uniquement |
| SOURCE_CONTRACT | source_id stable + source_version_id exacte ; appartenance et états vérifiés |
| MIGRATION_DECISION | MIG-0018 corrigée avec checksum recalculé ; aucune MIG-0019 |
| TARGETED_TESTS | PASS : 55/55 initiaux, MIG-0018 réorganisée 4/4, précontrôle isolé 12/12 |
| FULL_TESTS | NON VALIDÉ : 693 PASS, 1 timeout préexistant, 1 ignoré ; aucun échec d'assertion observé |
| TYPECHECK | PASS |
| LINT | PASS |
| BUILD | PASS |
| REAL_DB_TOUCHED | NON |
| DEPLOY | NON |
| LOT_10_STARTED | NON |
| FINDINGS | A1 corrigé ; stabilité temporelle de la suite complète à confirmer ; A2/A3/A4 éditoriaux toujours ouverts |
| SAFE_FOR_FINAL_REVIEW | NON pour une acceptation finale sans réserve : une suite complète verte reste nécessaire. Le diff est disponible pour revue de la correction. |

Aucune augmentation de timeout, suppression de test, nouvelle exclusion ou modification de code hors périmètre n'a été utilisée pour obtenir un résultat vert. La mission s'arrête avec ce résultat exact. **Verdict de gate conservé : NOT READY FOR LOT 10.** Aucun push ou merge n'est effectué.

## 9. Correction additive suivant la dernière décision de gate — 10 septembre 2026

### Décision courante et état restauré

**MIGRATION_DECISION = MIG-0018 IMMUTABLE / CORRECTION ADDITIVE PAR MIG-0019**

La dernière décision humaine remplace la stratégie de la section 8. MIG-0018 est restaurée exactement depuis `4cafa638fae1781c3515974235ebd1cb665cb114` : définition, postcondition, description et matériau de checksum. La comparaison Git de ce fichier avec ce commit ne présente aucune différence. MIG-0001 à MIG-0017 ne sont pas modifiées. Le registre réel a été inspecté avant modification : il se terminait à MIG-0018 ; MIG-0019 était disponible.

| Migration | Transition | Checksum canonique |
|---|---|---|
| MIG-0018 historique restaurée | 17 → 18 | `b4ce8d19a3f5cf6e8c148c4b62243e4b077898bf19b353451e1af16e41708d0b` |
| MIG-0019 ajoutée | 18 → 19 | `0c5d41ae2672763e4c962dbf04e1117186925961329dfd7e37720b2f285129dd` |

Le checksum `32f72dae...` de la correction retirée n'est pas accepté comme alias. Le test MIG-0018 vérifie désormais le checksum historique et le refus de cette définition retirée. Une fixture synthétique créée avec cette dernière doit être recréée ; aucune procédure ne réécrit un checksum enregistré pour la faire accepter. Le commit local `21286202d42579e31bfb1d26f47429d8193fd5b3` n'a pas été poussé ; cette correction le remplace dans l'état de travail courant, sans rebase ni réécriture Git.

### Opérations de MIG-0019 et compatibilité

Le résolveur applicatif corrigé est conservé sans changement : `targetId = source_id`, `targetVersion = source_version_id`, appartenance exacte, source READY et extraction de la version demandée COMPLETED. Il n'impose ni n'utilise la version courante. Ces états techniques ne constituent aucune approbation clinique.

La colonne générée historique ne permet pas de changer sa définition directement. MIG-0019 est une nouvelle migration dans le journal et utilise une **reconstruction transactionnelle** de la seule table `mle_resource_links` : création d'un index UNIQUE natif, création d'une table intermédiaire avec la nouvelle FK composite, copie de toutes les lignes, remplacement de l'ancienne table, puis validation. Le DDL contient donc un `DROP TABLE` interne à la transaction ; il ne s'agit pas d'une suppression de liens ni d'une suppression d'historique. Aucune table intermédiaire ne subsiste après succès ou rollback.

Pour un ancien lien SOURCE renseigné, `target_id` et `target_version` doivent tous deux désigner la même version native existante. MIG-0019 retrouve son parent par `source_versions.source_version_id = ancien target_id`, écrit ce `source_id` dans le nouveau `target_id` et conserve exactement `target_version`. Aucune résolution clinique, recherche approximative, version maximale ou publication n'intervient. Les liens non renseignés et les autres ResourceKind conservent tous leurs champs ; les identités de concepts, positions, labels et provenances sont préservés.

Une paire ancienne ambiguë est refusée avant tout remplacement, avec rollback et sans entrée MIG-0019 ajoutée. Les contraintes de clé étrangère restent actives. La migration n'exécute aucun UPDATE/DELETE sur `schema_migrations` ni sur les contenus natifs : le runner existant ajoute uniquement la nouvelle entrée MIG-0019 après validation. Les tests de corruption volontaire du journal restent exclusivement synthétiques et ne constituent pas des opérations de migration.

Le bootstrap valide le schéma historique à la version 18 et le schéma corrigé à la version 19. Le preflight reconnaît explicitement une base v18, exige toujours un backup et une autorisation séparée pour une activation réelle, et valide le schéma v19. La version opérationnelle maximale passe à 19 via le registre existant. Aucun chemin d'activation automatique sur une base réelle n'est ajouté.

### Contrôles et preuves

| Contrôle | Preuve | Résultat |
|---|---|---|
| MIG-0018 restaurée exactement | Comparaison Git au commit 4cafa63 et assertion du checksum historique | PASS |
| Fresh DB → MIG-0001…MIG-0019 | Base en mémoire ; liste ordonnée des 19 migrations ; checksums 18 et 19 | PASS |
| Ancienne MIG-0018 déjà appliquée → MIG-0019 | Base en mémoire v18 contenant le pilote et un lien SOURCE ancien | PASS |
| Historique préexistant intact | Comparaison intégrale des 18 entrées avant/après, pas seulement des checksums | PASS |
| Liens et contenus préservés | Comparaison de toutes les lignes de liens, concepts et source_versions ; seule identité SOURCE convertie | PASS |
| Version exacte conservée | Version V1 référencée alors que la source est courante en V2 | PASS |
| Paires ambiguës refusées | Ancien target_id V1 / target_version V2 ; aucun changement de données/historique | PASS |
| Rollback pendant reconstruction | Échec injecté juste après DROP ; ancienne table, lignes et journal restaurés ; index/intermédiaire absents | PASS |
| Idempotence et preflight | Deuxième exécution sans migration ; état v19 reconnu ; v18 bloquée sans backup | PASS |
| FK et index | Mauvais parent refusé ; index absent détecté ; intégrité et foreign_key_check | PASS |
| Régressions SOURCE et autres familles | Tests applicatifs conservés ; toutes les nouvelles contraintes exécutées sur v19 | PASS en ciblé |
| Concepts et rattachements éditoriaux | Sept concepts DRAFT, reviewers nuls ; dix propositions documentaires inchangées | PASS |

### Fichiers concernés

- `docs/CODEX-GUARDRAILS.md` : décision explicite de gel de MIG-0018, prioritaire sur les critères généraux.
- `src/infrastructure/database/sqlite/migrations/definitions/mig-0018-mle-concept-catalog.ts` : restauration historique exacte.
- `src/infrastructure/database/sqlite/migrations/definitions/mig-0019-mle-source-identity.ts` : nouvelle migration et validateur v19.
- `src/infrastructure/database/sqlite/migrations/core-migration-registry.ts` : enregistrement MIG-0019.
- `src/infrastructure/database/sqlite/migrations/fresh-database-bootstrap.ts` et `src/infrastructure/database/sqlite/preflight/database-migration-preflight.ts` : validation du schéma selon sa version.
- `src/infrastructure/database/sqlite/migrations/mig-0019-mle-source-identity.test.ts` : sept tests nouveaux de migration.
- `src/infrastructure/database/sqlite/migrations/mig-0018-mle-concept-catalog.test.ts` : périmètre historique v18 et checksum attendu restauré ; vérification d'index SOURCE portée par les tests v19.
- Tests existants dont les attentes de version courante sont actualisées, sans suppression d'assertion : `activation/controlled-migration-activation.test.ts`, `activation/migration-operator-cli.test.ts`, `backup/sqlite-backup-service.test.ts`, `migrations/database-readiness-orchestrator.test.ts`, `migrations/fresh-database-bootstrap.test.ts`, `migrations/legacy-baseline-adopter.test.ts`, `migrations/mig-0003-source-model.test.ts`, `migrations/mig-0010-calculations-lab-core.test.ts`, `migrations/mig-0011-osce-text-core.test.ts`, `migrations/mig-0012-closed-web-pilot.test.ts`, `migrations/mig-0017-mcq-session-specialization.test.ts`, `operational-schema-support.test.ts`, `preflight/database-migration-preflight.test.ts` (tous sous `src/infrastructure/database/sqlite/`). Les scénarios de version future utilisent désormais MIG-0020 ; cette migration fictive existe uniquement dans les tests.
- `docs/reports/RAPPORT-GATE-FINAL-LOT-9-MLE-01.md` : présent rapport et indication explicite de la stratégie retirée.

### Gates rejoués

| Gate | Commande / résultat |
|---|---|
| TARGETED_TESTS | `vitest run` sur MIG-0018, MIG-0019 et infrastructure MLE, `--maxWorkers=1` : **32/32 PASS**, quatre fichiers, 45,11 s |
| FULL_TESTS | PASS : **147 fichiers, 703 tests réussis, 1 test ignoré (704)**, 575,86 s, code 0 ; un worker, aucun autre gate lourd concurrent |
| TYPECHECK | `node node_modules/typescript/bin/tsc --noEmit` : PASS, code 0 |
| LINT | `node node_modules/eslint/bin/eslint.js .` : PASS, code 0 |
| BUILD | `node node_modules/next/dist/bin/next build` : PASS, compilation 36,4 s, TypeScript 12 s, 22/22 pages générées ; données dirigées vers un répertoire temporaire unique |
| DIFF_CHECK | `git diff --check` : PASS |

### Timeout global, traité séparément

Le timeout du gate précédent reste documenté dans la section 8 ; il n'est pas utilisé pour conclure sur la nouvelle migration. Aucun timeout n'est augmenté, aucun test n'est supprimé ou nouvellement ignoré. La nouvelle suite complète termine avec le code 0 : 703 tests réussis, un test OCR conditionnel préexistant ignoré, aucun timeout et aucun échec. Le dépassement précédent ne se reproduit pas dans cette exécution ; cela ne constitue pas une garantie de durée sur tout environnement.

### Limites, rollback et arrêt

Les anciennes lignes SOURCE peuvent désormais être converties, mais aucune base réelle n'est inspectée ou migrée dans cette mission. Une base portant la définition retirée de MIG-0018 échoue au contrôle d'historique, sans réécriture automatique. Une référence ancienne ambiguë nécessite une décision distincte ; elle n'est ni éliminée ni rapprochée approximativement.

En cas d'échec de MIG-0019, le runner restaure transactionnellement la table v18, ses données et son historique ; ce scénario est testé après le DROP interne. Après une éventuelle activation réelle future, revenir à v18 exigerait un plan de restauration autorisé depuis un backup vérifié, et non un effacement de l'entrée MIG-0019. Aucun downgrade automatique n'est fourni.

La conservation et l'approbation clinique des versions natives restent sous l'autorité des mécanismes existants. Les points éditoriaux A2/A3/A4 restent ouverts ; les dix rattachements restent PROPOSÉS et les sept concepts DRAFT. Ni contenu clinique ni données apprenant ne sont copiés ou modifiés.

**SAFE_FOR_FINAL_REVIEW = OUI pour la correction de migration LOT 9.** Les deux chemins sont vérifiés et les gates sont rejoués avec succès. Cette conclusion ne valide ni les rattachements éditoriaux ni le démarrage de LOT 10.

**REAL_DB_TOUCHED = NON ; DEPLOY = NON ; PUSH = NON ; MERGE = NON ; LOT_10_STARTED = NON.** Aucune opération Render. Arrêt après cette correction. Le verdict éditorial demeure **NOT READY FOR LOT 10**.
### Résumé final de la correction additive

| Champ | Résultat |
|---|---|
| STATUS | CORRECTION ADDITIVE TERMINÉE — PRÊTE POUR REVUE |
| FILES_CHANGED | 22 fichiers : liste détaillée ci-dessus ; aucun fichier de données réelles |
| SOURCE_CONTRACT | targetId = source_id ; targetVersion = source_version_id |
| MIGRATION_DECISION | MIG-0018 IMMUTABLE / CORRECTION ADDITIVE PAR MIG-0019 |
| TARGETED_TESTS | PASS — 32/32 |
| FULL_TESTS | PASS — 703 réussis, 1 ignoré, 147 fichiers, code 0 |
| TYPECHECK | PASS |
| LINT | PASS |
| BUILD | PASS |
| DIFF_CHECK | PASS |
| REAL_DB_TOUCHED | NON |
| DEPLOY | NON |
| LOT_10_STARTED | NON |
| FINDINGS | Stratégie retirée remplacée ; aucun timeout reproduit ; conditions éditoriales A2/A3/A4 toujours ouvertes |
| SAFE_FOR_FINAL_REVIEW | OUI — correction seulement ; aucune autorisation de push, merge, déploiement ou LOT 10 |

**STOP après la correction.** Les dix propositions restent PROPOSÉES et les concepts DRAFT.
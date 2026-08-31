# AUDIT DE FINALISATION — MENTOR PLATEFORME

Date de l'audit : 2026-08-28
Branche : `main`
HEAD audité : `7bcd6d9b2d64f2a78b83583c6331f09c23868be0` (`feat(pilot): harden provisioning persistence and diagnostics`)
Relation Git initiale : `main...origin/main`, sans divergence annoncée par `git status --short --branch`
Périmètre : dépôt local complet, code, tests, migrations, documentation, historique Git et travaux locaux non commités.
Limite de sécurité : `data/mentor.db` n'a été ni ouverte, ni interrogée, ni modifiée. Les constats sur la base utilisateur réelle sont donc volontairement non déterminés.

## 1. Résumé exécutif

Mentor Plateforme possède un socle technique substantiel et généralement bien testé : architecture en couches, migration SQLite contrôlée, sauvegardes vérifiées, Auth0, provisioning pilote, quotas, diagnosticabilité, extraction documentaire, RAG local, moteurs Foundation, Canadian Practice, Calculations, OSCE et MCQ. La campagne de validation de cet audit est entièrement verte : 561/561 tests, build Next.js 22/22 pages, TypeScript et ESLint sans erreur.

Le produit n'est toutefois pas finalisé. Plusieurs lots qualifiés historiquement de « core » fournissent surtout le modèle métier, la persistance et l'API, sans contenu pédagogique exploitable ni parcours UI complet. Le premier corpus MCQ SNC est préparé mais son import réel n'a pas abouti. Plusieurs pages legacy peuvent encore afficher `Loading` indéfiniment après une erreur terminale. Les données legacy exposées par `/api/state` et modifiées par `/api/actions` ne sont pas isolées par apprenant, ce qui est bloquant pour un pilote multi-utilisateur. Le déploiement Render et son disque persistant doivent enfin être vérifiés dans l'environnement réel ; ce point ne peut pas être prouvé depuis le dépôt.

Estimation d'avancement global vers un pilote V6.2.2 réellement exploitable : **63 %** (confiance moyenne). Cette valeur est une estimation structurée, pas une mesure automatique : 35 % socle/architecture, 35 % fonctionnalités utilisables de bout en bout, 20 % contenu pédagogique, 10 % exploitation/sécurité. Les scores observés sont respectivement 90 %, 60 %, 20 % et 65 %. Le pourcentage ne signifie pas que 63 % des lignes sont écrites.

Verdict : **NON VALIDABLE pour ouverture du pilote**, mais **validable comme socle technique avancé avec réserves majeures**.

## 2. Méthode, preuves et limites

Sources examinées :

- `README.md`, `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/TRACEABILITY.md`, tous les rapports sous `docs/reports/`, les runbooks et spécifications suivis ou locaux ;
- PRD extrait `.prd_extract/prd.txt` et documents normatifs présents dans `dossier evolution/` ;
- 348 fichiers sous `src/`, dont 121 fichiers de tests, 19 fichiers de routes API et 15 définitions de migration ;
- historique Git, branches, commits de merge et état complet suivi/non suivi ;
- migrations MIG-0001 à MIG-0015 et tests synthétiques ;
- commandes de validation listées à la section 14.

Limites :

- aucune connexion à Render, Auth0, GitHub ou un fournisseur IA ;
- aucune lecture de `data/mentor.db` ni des backups protégés ;
- aucune confirmation de l'état réel du disque Render, de la version réelle de la base utilisateur ou du contenu réel en production ;
- aucun import, seed, bootstrap utilisateur, migration réelle, commit, push ou déploiement ;
- les documents non suivis et rapports historiques sont des preuves de travail, mais non des garanties qu'un état externe subsiste.

## 3. État Git et configuration du dépôt

Le dépôt est sur `main`, HEAD `7bcd6d9`, synchronisé avec `origin/main` au moment du contrôle. L'arbre de travail est fortement chargé avant cet audit : 45 fichiers suivis modifiés (693 insertions, 156 suppressions) et de nombreux fichiers non suivis. Ces changements appartiennent aux travaux locaux préexistants et ont été préservés.

Principaux travaux locaux suivis : séparation build/runtime Render, UI d'accueil, branchement MCQ moderne, adaptations migration/preflight, scripts et politique pnpm. Principaux travaux locaux non suivis : MIG-0014, MIG-0015, import MCQ, alias éditorial de source, corpus SNC, tests associés et dashboard de présentation.

Éléments explicitement exclus de toute mutation : `.tmp-migration-runner/`, `backups/`, `DOCS1/`, `content-sources/`, `dossier evolution/`, `mentor-platform-restaure/`, `data/`, `.env.local` et les rapports préexistants. Le seul fichier créé par cet audit est le présent rapport.

Risque Git immédiat : le périmètre local mélange au moins quatre sujets — séparation build/runtime, refonte UI, MCQ content import/MIG-0014 et alias source/MIG-0015. Une intégration en un commit unique rendrait la revue et le rollback difficiles.

## 4. Architecture et qualité du socle

### 4.1 Points forts

- séparation explicite `domain` / `application` / `infrastructure` / `presentation`, contrôlée par `src/architecture-boundaries.test.ts` ;
- domaines typés et cas d'usage testables pour Foundation, Canadian Practice, Calculations, OSCE, MCQ, documents et coach ;
- accès SQLite centralisé, transactions, FK et tests d'intégration ;
- migrations versionnées et activation humaine contrôlée via `ControlledMigrationActivation` ;
- sauvegardes manifestées, checksumées, vérifiées et restauration en staging ;
- Auth0 isolé derrière un adaptateur et résolution serveur `subject → account → learnerId` ;
- réponses API diagnostiquables avec codes stables, `traceId`, logs structurés et endpoint `/api/readiness` ;
- séparation build/runtime : `src/lib/db.ts` paresseux et `src/instrumentation.ts` ignore `phase-production-build` ;
- contrôle Render fail-closed dans `scripts/check-persistent-storage.mjs` au runtime.

### 4.2 Faiblesses structurelles

- coexistence d'un modèle legacy global et de modules modernes par apprenant ;
- orchestration et politiques provisoires codées dans les runtimes Foundation/OSCE/Coach ;
- documentation d'architecture et `README.md` partiellement obsolètes par rapport au code ;
- registre historique encore lié à MIG-0001, même si l'extraction locale vers `core-migration-registry.ts` réduit la dette ;
- dépendance opérationnelle au lanceur `tsx`, actuellement instable sous l'environnement Windows audité ;
- absence d'une stratégie de contenu validé couvrant les modules au-delà du premier corpus SNC.

## 5. Reconstruction des lots et statut réel

| Lot / tranche | Preuves principales | Statut réel | Classification |
|---|---|---|---|
| LOT 0 — audit/sécurité | documents `dossier evolution/`, rapports historiques | audit réalisé, documentation partiellement vieillissante | C — partiellement terminé |
| LOT 1 — socle/reproductibilité | historique initial, architecture, scripts qualité | socle opérationnel et testé | A — terminé |
| LOT 2 — bibliothèque/import | `ImportDocuments`, `CrashSafeDocumentImport`, migrations 2–3 | PDF/DOCX/TXT/MD opérationnels ; OCR et workflow opérateur incomplets | C |
| LOT 3 — RAG/citations | MIG-0004, `AskAiTeacher`, retrieval/evidence tests | retrieval local et citations présents ; pas de vrai professeur LLM ni d'évaluation de qualité | C |
| LOT 4 — coach clinique | MIG-0005, coach domain/API/tests | moteur déterministe et cas synthétique ; contenu/IA clinique réels absents | C |
| LOT 4.1 — corrections coach | branches/patchs historiques | aucune preuve que le patch 4.1 soit intégré à `main` ; statut externe non déterminable | E — bloqué/non déterminé |
| LOT 5 — MCQ Core | commit `275be74`, MIG-0006, routes MCQ | moteur versionné intégré ; tranche contenu MIG-0014 locale et import réel non abouti | C |
| FND-01 — Foundation Academy | merge `5d9dcda`, MIG-0007 | domain/persistence/API complets ; curriculum réel, politiques finales et UI absents | C |
| FND-02 / QC — Canadian Practice | merges `33fe841`, `7fa387d`, MIG-0008/9 | modèles/API présents ; contenu réglementaire et UI incomplets | C |
| FND-03 — Calculations Lab | merge `ee1ae70`, MIG-0010 | moteur, persistance et API complets ; exercices et UI dédiés absents | C |
| OSCE-TXT-01 | merge `6262e15`, MIG-0011 | moteur texte/persistance/API présents ; stations, scoring expert et runner UI absents | C |
| PILOT-WEB-01 | merge `6100fd4`, HEAD `7bcd6d9`, MIG-0012/13 | Auth0/provisioning/quotas/readiness présents ; isolation legacy et exploitation Render non closes | C |
| MCQ Content Import | MIG-0014 et corpus SNC locaux non suivis | code/tests prêts, corpus publié préparé, import réel bloqué par le lanceur | D — commencé non terminé |
| Source Editorial Alias | MIG-0015 et cas d'usage locaux non suivis | implémentation/test local, pas intégrée à Git ; état DB réelle non vérifié | D |

Conclusion : aucun élément probant n'est classé « annoncé mais absent » pour les cores principaux ; l'écart vient surtout du mot « validé », souvent utilisé pour un core technique alors que l'expérience produit et le contenu restent incomplets.

## 6. Base de données et migrations

Le code cible actuellement le schéma **v15** avec MIG-0001…MIG-0015. MIG-0014 ajoute les métadonnées éditoriales MCQ ; MIG-0015 ajoute les alias éditoriaux immuables de versions de source. Les deux définitions sont locales et non suivies. Les tests synthétiques couvrent les migrations et la campagne globale est verte.

La base utilisateur réelle n'a pas été ouverte. Par conséquent :

- version réelle de `data/mentor.db` : **NON DÉTERMINÉE** ;
- intégrité réelle : **NON DÉTERMINÉE** ;
- migrations réellement appliquées : **NON DÉTERMINÉES dans cet audit** ;
- données utilisateur préservées : aucune écriture effectuée par l'audit, mais contenu non inspecté.

Le mécanisme de sécurité est bon : une base existante obsolète est refusée, une base absente peut être bootstrapée uniquement au runtime, et la migration d'une base existante exige prepare/backup/autorisation/execute/post-validation. Le risque principal est organisationnel : MIG-0014/15 et le registre correspondant ne sont pas encore intégrés proprement, alors que des rapports locaux mentionnent des activations sur une base de prévisualisation. Il faut réconcilier code Git, version de chaque environnement et preuves d'activation avant tout nouveau déploiement.

## 7. Fonctionnalités : état de bout en bout

### 7.1 Authentification et pilote

Auth0, provisioning manuel, allowlist opérateur, comptes ACTIVE, quotas et audit dédié sont présents. Les tokens ne sont pas stockés dans la base métier. `/api/readiness` distingue les sous-systèmes sans exposer les secrets.

Blocage majeur : les tables et actions legacy consommées par `/api/state` et `/api/actions` sont globales. L'authentification protège la route, mais ne garantit pas que deux apprenants voient des données distinctes. Les sessions MCQ modernes, elles, portent `learner_id` et vérifient l'ownership.

### 7.2 Accueil et navigation

La refonte locale de `/` est moderne, responsive et orientée PEBC. Elle dérive les données disponibles et affiche des états neutres. Toutefois, `useAppState` met `data=null` lors d'erreurs terminales et plusieurs pages continuent de rendre uniquement `<Loading />` dans ce cas : `flashcards`, `mock-exams`, `weaknesses`, `study-plan`, `settings`, `search`, `progress`, `ai` et `library`. Le correctif transversal annoncé n'est donc pas complet.

### 7.3 MCQ

`/quizzes` utilise le moteur moderne, protège la clé avant soumission et renvoie correction/explication après réponse. MIG-0014, contrat `MCQ_CORPUS/1`, import transactionnel/idempotent, repository et tests sont présents localement. Le corpus SNC de 10 items est documenté et publié dans un JSON local.

Blocages : le premier import réel n'a pas démarré ; `tsx` échoue dans l'environnement Windows (`uv_os_get_passwd` / `ENOMEM`) malgré l'autorisation ciblée d'`esbuild`. `/mock-exams` utilise encore les questions et le runner legacy : le produit possède donc toujours deux chemins QCM.

### 7.4 Foundation Academy

Domain, repository, diagnostic, progression, exit assessment, API et curriculum seed technique sont présents. Le seed est DRAFT, comporte six blocs techniques et n'est pas un curriculum pédagogique final. Les policies sont provisoires et la décision d'exit reste simplifiée. Il n'existe pas d'UI Foundation complète.

### 7.5 Canadian Practice

Le cœur fédéral/ON/QC et les migrations sont présents. Aucun corpus réglementaire versionné complet ni parcours UI utilisable n'a été identifié. Les règles doivent être sourcées, datées et révisables avant usage pédagogique réel.

### 7.6 Calculations Lab

Unités, dimensions, plausibilité, erreurs critiques, remédiation, retest, persistance et API sont testés. Il manque une banque d'exercices sourcée et une UI dédiée permettant de parcourir les étapes et l'historique.

### 7.7 OSCE textuel

Stations versionnées, sessions, interactions append-only, chronométrage serveur, assessment/debrief/replay et ownership sont modélisés. Le runtime de scoring demeure principalement fondé sur le nombre d'interactions ; l'adaptateur de remédiation est minimal. `/clinical-cases` est un hub vide et non un runner de station.

### 7.8 Coach clinique

Le domaine de revue médicamenteuse et les garde-fous sécurité sont solides. Le runtime utilise un cas synthétique et un provider déterministe ; il ne s'agit pas encore d'un coach clinique alimenté par des cas réels validés ni par un modèle IA contrôlé.

### 7.9 Bibliothèque, recherche et RAG

L'import crash-safe, l'extraction PDF/DOCX/TXT/MD, le chunking, l'index local, la recherche hybride, l'evidence gate et les citations existent. Les PDF image nécessitent un OCR non implémenté. Le professeur IA concatène des extraits récupérés ; aucun provider LLM de production n'est connecté. L'évaluation retrieval/réponse, le reranking et les procédures d'indexation opérateur restent à compléter.

## 8. Sécurité, confidentialité et diagnosticabilité

Conformes ou avancés : Auth0 officiel, identité serveur, pas de token métier, redaction récursive du logger, traceId, codes stables, readiness non sensible, validation Zod, erreurs internes masquées, stockage Render fail-closed au runtime, migrations non implicites pour les bases existantes.

Écarts prioritaires :

1. isolation apprenant absente sur les données legacy ;
2. états UI terminalement masqués par `Loading` sur neuf pages ;
3. absence de preuve locale que le disque Render réel est attaché et sauvegardé ;
4. contenu clinique et réglementaire encore incomplet ou non publié ;
5. pas d'E2E automatisé Auth0 → account → dashboard → MCQ sur un environnement proche production ;
6. rapports affirmant parfois des garanties plus larges que les tests/code actuels.

## 9. Documentation et traçabilité

La documentation est abondante : ADR, runbooks, rapports par lot, spécifications sécurité/engineering/observabilité et traçabilité. Elle a toutefois évolué par accumulation. `README.md`, `docs/ARCHITECTURE.md`, `docs/TRACEABILITY.md` et certains rapports ne reflètent plus exactement les migrations v14/v15, la séparation build/runtime, les routes actuelles ou les limites produit.

Le rapport `RAPPORT-ETAT-DEVELOPPEMENT.md` est daté d'un ancien HEAD et ne doit pas servir d'état courant. Les rapports FND/OSCE/Pilot prouvent des gates historiques, mais « validé » y signifie souvent « code du lot testé », pas « fonctionnalité alimentée et exploitable en production ».

## 10. Dette technique et incohérences

- `TECH-DEBT-MIG-REGISTRY` : registre historiquement colocalisé avec MIG-0001 ; extraction locale non encore intégrée.
- modèle legacy global non aligné avec le modèle `learner_id` moderne ;
- deux parcours QCM (`/quizzes` moderne, `/mock-exams` legacy) ;
- policies Foundation/OSCE/Coach provisoires ou déterministes ;
- aucune couche commune complète d'état terminal UI malgré les contrats de diagnostic ;
- `tsx` inutilisable dans l'environnement audité, bloquant les commandes TypeScript d'exploitation ;
- OCR absent ;
- pas de LLM de production, pas de pipeline d'évaluation IA ;
- contenu pédagogique réel limité au corpus SNC préparé ;
- documentation de haut niveau obsolète ;
- avertissements LF/CRLF sur de nombreux fichiers locaux ;
- importante divergence locale non commitée, augmentant le risque de perte ou d'intégration hors périmètre.

La recherche `TODO|FIXME|HACK|XXX` n'a trouvé aucun marqueur significatif sous `src` et `docs`. Cette absence ne réduit pas les écarts fonctionnels ci-dessus.

## 11. Backlog de finalisation DEV

Complexité : S (petit), M (moyen), L (grand), XL (très grand). Crédits réalistes estimés à partir de tâches comparables et non d'une télémétrie Codex disponible ; ils doivent être traités comme budgets, pas comme devis.

| ID | P | Tâche et résultat attendu | Composants | Tests / DoD | Complexité | Crédits réalistes |
|---|---:|---|---|---|---:|---:|
| DEV-001 | P0 | Découper et intégrer proprement l'arbre local par périmètre | Git, build/runtime, UI, MCQ, migrations | diffs revus, gates verts, aucun protégé | L | 300 |
| DEV-002 | P0 | Réparer le lanceur d'exploitation TypeScript sans affaiblir pnpm | pnpm, `tsx`, scripts | help + dry-run MCQ fonctionnels Windows/CI | M | 220 |
| DEV-003 | P0 | Importer contrôlément le corpus SNC et valider le parcours | MCQ importer/API/UI | 10/10, aucune fuite clé, session smoke | M | 180 |
| DEV-004 | P0 | Éliminer tous les spinners infinis | hook state + 9 pages | tests 401/403/409/5xx/network/timeout | M | 260 |
| DEV-005 | P0 | Isoler toutes les données legacy par `learner_id` | state/actions/schema/repos | tests croisés deux apprenants, aucune fuite | XL | 600 |
| DEV-006 | P0 | Réconcilier versions Git/migrations/environnements | MIG-0014/15, registry, runbook | matrice versions + activations contrôlées | L | 300 |
| DEV-007 | P0 | Valider réellement Render disque/readiness/backup | Render runbook/exploitation | mount réel, restart, backup/restore staging | L | 350 |
| DEV-008 | P0 | E2E fermé Auth0 → provisioning → dashboard → MCQ | Auth0/API/UI | scénario sans secret, erreurs corrélées | L | 340 |
| DEV-009 | P1 | Publier un curriculum Foundation réel versionné | Foundation content | revue documentaire/éditoriale + import | XL | 500 |
| DEV-010 | P1 | Finaliser les policies Foundation | diagnostic/progression/exit | critères sourcés et tests décisionnels | L | 350 |
| DEV-011 | P1 | Construire l'UI Foundation complète | pages/components/API | diagnostic, unités, reprise, exit | XL | 500 |
| DEV-012 | P1 | Créer une banque OSCE textuelle validée | OSCE content | versions, rubrics, safety review | XL | 520 |
| DEV-013 | P1 | Remplacer le scoring OSCE provisoire | OSCE assessment | critères explicites, cas limites | L | 360 |
| DEV-014 | P1 | Construire le runner UI OSCE | clinical-cases/API | start/interact/timer/debrief/replay | XL | 470 |
| DEV-015 | P1 | Créer des exercices Calculations sourcés | calculations content | unités/plausibilité/solutions revues | L | 320 |
| DEV-016 | P1 | Construire l'UI Calculations | calculations API/UI | étapes, feedback, retest, historique | L | 360 |
| DEV-017 | P1 | Publier contenu Canadian Practice fédéral/ON/QC | practice content | provenance/version/obsolescence | XL | 520 |
| DEV-018 | P1 | Construire l'UI Canadian Practice | API/UI | navigation, cas, erreurs, progression | L | 360 |
| DEV-019 | P1 | Intégrer un provider LLM contrôlé | AI adapter/config | evidence-only, timeout, coût, redaction | L | 420 |
| DEV-020 | P1 | Mettre en place évaluations RAG/IA | datasets/evals | recall, citation, groundedness, safety | XL | 480 |
| DEV-021 | P1 | Remplacer le cas coach synthétique par corpus validé | coach/content | provenance, versions, sécurité | L | 360 |
| DEV-022 | P1 | Brancher la remédiation coach sur le parcours | coach/foundation/progress | événements traçables, ownership | L | 340 |
| DEV-023 | P1 | Unifier `/mock-exams` avec MCQ Core | UI/API/MCQ | aucun moteur legacy, historique préservé | L | 330 |
| DEV-024 | P2 | Ajouter OCR contrôlé | documents/extractor | PDF image, limites, erreurs stables | L | 300 |
| DEV-025 | P2 | Industrialiser indexation/re-indexation RAG | jobs/runbook/readiness | idempotence, reprise, métriques | L | 280 |
| DEV-026 | P2 | Unifier progression multi-modules | progress/read models | MCQ/Foundation/OSCE/Calc cohérents | XL | 430 |
| DEV-027 | P2 | Refaire plan d'étude à partir des signaux réels | study-plan | aucune recommandation fictive | L | 260 |
| DEV-028 | P2 | Brancher flashcards/weaknesses aux données modernes | UI/read models | ownership et états vides | L | 250 |
| DEV-029 | P2 | Durcir les erreurs locales search/library/AI | UI/API | `response.ok`, codes, traceId, timeout | M | 180 |
| DEV-030 | P2 | Ajouter administration de contenu minimale | documents/MCQ/admin | import/revue sans SQL manuel | L | 300 |
| DEV-031 | P2 | Mettre en place métriques et alertes d'exploitation | logs/readiness/Render | alertes DB/migration/quota/API | M | 220 |
| DEV-032 | P2 | Tester restauration et reprise après incident | backup/runbook | exercice staging documenté | M | 180 |
| DEV-033 | P2 | Réconcilier documentation et traçabilité | README/architecture/reports | état exact, limites explicites | M | 160 |
| DEV-034 | P3 | Tests E2E accessibilité et responsive | Playwright/UI | WCAG, desktop/tablette/mobile | L | 260 |
| DEV-035 | P3 | Profilage performance et volumétrie SQLite | API/DB | budgets latence/charge 20 pilotes | L | 280 |
| DEV-036 | P3 | Décider trajectoire SQLite multi-instance | ADR/architecture | seuils et plan sans surconstruction | M | 180 |

Comptage : **36 tâches** — P0 : 8, P1 : 15, P2 : 10, P3 : 3.

## 12. Budgets crédits et coûts

Conversion imposée : 2 500 crédits = 100 $, donc **1 crédit = 0,04 $**.

| Priorité | Économique | Réaliste | Prudent / qualité maximale |
|---|---:|---:|---:|
| P0 | 1 700 cr / 68 $ | 2 550 cr / 102 $ | 3 800 cr / 152 $ |
| P1 | 4 100 cr / 164 $ | 6 190 cr / 247,60 $ | 9 300 cr / 372 $ |
| P2 | 1 700 cr / 68 $ | 2 560 cr / 102,40 $ | 3 900 cr / 156 $ |
| P3 | 450 cr / 18 $ | 720 cr / 28,80 $ | 1 100 cr / 44 $ |
| **Total** | **7 950 cr / 318 $** | **12 020 cr / 480,80 $** | **18 100 cr / 724 $** |

Hypothèses : stratégie économique réutilise fortement les composants et limite l'E2E ; stratégie réaliste inclut tests ciblés, revue et une itération corrective ; stratégie prudente inclut davantage d'évaluations cliniques, E2E, sécurité, observabilité et marge d'échec. L'absence de métrique réelle de consommation par tâche empêche une précision supérieure ; une marge de ±35 % est raisonnable.

Répartition réaliste par lots proposés :

- LOT DE STABILISATION (DEV-001…008) : 2 550 crédits ;
- LOT 6 — contenu et expériences Foundation/OSCE/Calculations/Practice/Coach (DEV-009…022) : 5 860 crédits ;
- LOT 7 — unification apprentissage, RAG et administration (DEV-023…033) : 2 890 crédits ;
- LOT 8 — qualité non fonctionnelle et trajectoire (DEV-034…036) : 720 crédits.

## 13. Roadmap recommandée

### Phase 0 — sécuriser l'état local

DEV-001, 002 et 006. Séparer les changements, stabiliser le lanceur, réconcilier les migrations et remettre chaque périmètre sous contrôle Git. Aucun travail produit supplémentaire avant cela.

### Phase 1 — rendre le pilote sûr et réellement utilisable

DEV-003, 004, 005, 007 et 008. Importer le premier contenu, éliminer les erreurs masquées, isoler les apprenants et prouver le déploiement durable. C'est le chemin critique.

### Phase 2 — compléter les verticales pédagogiques

DEV-009…023. Traiter une verticale à la fois avec contenu sourcé, moteur, UI et mesure de progression. Ordre conseillé : Foundation, MCQ/mock exam, Calculations, OSCE, Canadian Practice, Coach.

### Phase 3 — rendre l'IA et la bibliothèque fiables

DEV-019, 020, 024, 025, 029 et 030. Ajouter provider/evals/OCR et administration sans mélanger cette complexité au cœur pédagogique.

### Phase 4 — convergence produit et exploitation

DEV-026…036. Read models de progression, plan d'étude, métriques, restauration, accessibilité, performance et décision d'architecture future.

## 14. Quality gates exécutés

Toutes les commandes ont utilisé le dépôt local. Les tests ont reçu un `MENTOR_DATA_DIRECTORY` temporaire absolu sous `%TEMP%` et `MENTOR_ENABLE_DEMO_DATA=0`. Aucune commande n'a ciblé `data/mentor.db`.

| Commande | Résultat exact |
|---|---|
| `.\node_modules\.bin\tsc.cmd --noEmit` | succès, exit 0, aucune sortie |
| `.\node_modules\.bin\eslint.cmd .` | succès, exit 0, aucune erreur/avertissement ESLint |
| `.\node_modules\.bin\vitest.cmd run --maxWorkers=1` | 122/122 fichiers, 561/561 tests, durée 210,34 s |
| build Render simulé avec `NODE_ENV=production`, `RENDER=true`, `NEXT_PHASE=phase-production-build`, variables Auth0/pilote factices et répertoire data temporaire | succès, Next.js 16.3.0, compilation 40 s, TypeScript 11,1 s, 22/22 pages |
| `git diff --check` | succès, exit 0 ; avertissements LF→CRLF seulement |

Le build confirme qu'aucune exigence de mount Render runtime ne bloque `Collecting page data`. Il ne prouve pas à lui seul l'absence absolue de toute écriture filesystem ; les tests `render-build-boundary` et l'architecture paresseuse apportent la preuve complémentaire.

## 15. Critères globaux de Definition of Done

Mentor Plateforme sera finalisable seulement lorsque :

1. l'arbre Git est propre, chaque lot est revu et toutes les migrations intégrées sont traçables ;
2. aucune base existante n'est migrée implicitement et chaque environnement possède une version confirmée ;
3. le disque Render persistant, backup et restauration staging sont testés ;
4. deux apprenants ne peuvent jamais lire ou modifier leurs données réciproques ;
5. aucune page ne reste en chargement après une erreur terminale ;
6. Auth0, provisioning, quotas, readiness et traceId passent un E2E proche production ;
7. chaque module visible possède un contenu versionné, sourcé et revu, ou un état vide explicite sans promesse trompeuse ;
8. `/quizzes` et `/mock-exams` utilisent un moteur MCQ unique, sans fuite de clé avant soumission ;
9. Foundation, Calculations et OSCE sont utilisables de bout en bout dans l'UI ;
10. le RAG est évalué, les réponses sont evidence-grounded et tout provider IA est observable, limité et expurgé ;
11. tests globaux, typecheck, lint, build, diff-check, sécurité et E2E sont verts ;
12. README, architecture, traçabilité, runbooks et rapport d'état décrivent l'état réel ;
13. aucune donnée clinique fictive n'est présentée comme contenu validé ;
14. un exercice de reprise prouve le RPO/RTO retenu ;
15. la validation humaine finale accepte explicitement le périmètre et les risques résiduels.

## 16. Risques bloquants et décisions requises

Bloquants P0 : isolation legacy par apprenant, spinners infinis, état Git composite, import MCQ non exécuté, cohérence migrations/environnements, preuve du disque Render et E2E pilote.

Décisions humaines nécessaires :

- conserver ou migrer les fonctionnalités legacy ;
- ordre des verticales pédagogiques et budget de validation clinique ;
- fournisseur/modèle IA, enveloppe de coût et critères d'évaluation ;
- seuil auquel SQLite mono-instance ne suffit plus ;
- critères exacts d'ouverture du pilote et personnes responsables des revues éditoriales/sécurité.

## 17. Verdict final et prochaine étape

**Avancement estimé : 63 %.**
**Tâches restantes structurées : 36 (P0 8, P1 15, P2 10, P3 3).**
**Verdict : NON VALIDABLE pour ouverture ; socle technique validable avec réserves.**

Prochaine action unique recommandée : **exécuter DEV-001 — découper et sécuriser l'arbre local actuel en périmètres revus, sans encore déployer ni migrer une base réelle.**

Actions non effectuées : aucune lecture/écriture de base utilisateur, aucune migration, ingestion, import réel, modification de code/configuration, installation, commit, push, merge, rebase, PR ou déploiement.

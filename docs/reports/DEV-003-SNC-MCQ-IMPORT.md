# DEV-003 — Import réel contrôlé du corpus SNC

## Objectif et périmètre

Importer de manière contrôlée le corpus `docs/content/SNC-QCM-PILOT-V4-PUBLISHED.mcq-corpus.json` dans la base locale de prévisualisation configurée, après preflight strict, sauvegarde vérifiée et validation des prérequis.

## Résultat

**FAIL — arrêt contrôlé avant toute écriture.**

La variable `MENTOR_DATA_DIRECTORY` de `.env.local` désigne :

`C:\Users\otcho\AppData\Local\Temp\mentor-local-preview`

La base attendue est donc :

`C:\Users\otcho\AppData\Local\Temp\mentor-local-preview\mentor.db`

Au moment du contrôle, ce fichier n'existait pas (`Test-Path = False`). La cible ne peut donc pas être confirmée comme une base locale de prévisualisation existante en schéma v15. La mission interdit de créer implicitement une base ou de sélectionner une autre base par supposition.

## Contrôles exécutés

```powershell
$dbLine = Select-String -LiteralPath '.env.local' -Pattern '^MENTOR_DATA_DIRECTORY=' | Select-Object -First 1
$dir = $dbLine.Line.Substring('MENTOR_DATA_DIRECTORY='.Length)
$db = Join-Path $dir 'mentor.db'
Test-Path -LiteralPath $db -PathType Leaf
git status --short --branch
git rev-parse HEAD
git rev-parse origin/main
```

Résultats pertinents :

- chemin configuré : `C:\Users\otcho\AppData\Local\Temp\mentor-local-preview\mentor.db` ;
- existence : `False` ;
- branche : `main` ;
- HEAD : `7bcd6d9b2d64f2a78b83583c6331f09c23868be0` ;
- `origin/main` : `7bcd6d9b2d64f2a78b83583c6331f09c23868be0`.

## Étapes non exécutées

En raison de l'échec du préflight initial :

- aucune ouverture SQLite ;
- aucun `integrity_check` ;
- aucune lecture ou validation du schéma ;
- aucune sauvegarde ;
- aucun dry-run supplémentaire ;
- aucune utilisation de l'autorisation d'import ;
- aucun import avec `--apply` ;
- aucun test d'idempotence ;
- aucun test API, session, soumission ou UI ;
- aucune ingestion documentaire, association d'alias ou migration ;
- aucune opération Render ;
- aucun commit, push ou déploiement.

## État des données

Aucune écriture de base n'a été effectuée. Le nombre d'items SNC dans la cible est **non vérifiable**, car la base configurée est absente. Il ne doit pas être présenté comme `0/10` sans base existante à interroger.

## Fichiers modifiés par DEV-003

- `docs/reports/DEV-003-SNC-MCQ-IMPORT.md` — rapport local d'arrêt contrôlé.

Aucun fichier de code, corpus, configuration ou migration n'a été modifié par DEV-003.

## Blocage et action corrective

Le prérequis manquant est une base locale de prévisualisation existante, explicitement identifiée, en schéma v15. Avant toute nouvelle tentative, l'opérateur doit restaurer ou fournir cette base au chemin configuré, ou autoriser explicitement un autre chemin exact. DEV-003 devra alors être repris depuis le preflight complet ; l'autorisation d'import n'a pas été consommée.

## Verdict

DEV-003 est **non validable** dans l'état actuel : aucune cible SQLite existante n'a pu être confirmée.

## DEV-003F — Tentative d'import réel sur staging restauré

La base staging `C:\Users\otcho\AppData\Local\Temp\mentor-local-preview-recovery\mentor-staging-v14.db` a été restaurée, migrée séparément en v15, puis la source SNC et son alias ont été rétablis dans les étapes autorisées précédentes.

Le preflight DEV-003F a confirmé : schéma v15, `integrity_check=ok`, aucune migration en attente, zéro item du corpus déjà importé, sourceVersion `8fdf1a28-6025-4846-a74b-1b4faca1d98f` présente et alias concordant. Le dry-run a retourné `VALIDATED_NOT_IMPORTED` pour 10/10 items.

Un backup officiel vérifié a été créé avant import :

- backup ID : `BKP-20260830011345266-06c4eac2` ;
- statut : `VERIFIED` ;
- schéma : 15 ;
- checksum : `0be33801f3f73863143d5ea7144bab4d4ceb3a20e74919bb3561e647a3983967`.

L'unique tentative autorisée `mcq:import --apply` a échoué avec le code `MCQ_ITEM_VERSION_GAP`. Le corpus publié contient les items `SNC-001` à `SNC-010` en version 2, tandis que la base reconstruite ne contient aucune version 1. `SqliteMcqCorpusWriter` interdit correctement qu'une première version persistée soit différente de 1.

La transaction a été intégralement annulée : zéro `mcq_question_items`, zéro `mcq_question_versions` SNC et zéro métadonnée du corpus ont été créés. `integrity_check` reste `ok` et le backup reste `VERIFIED`.

Conformément à la mission, aucun correctif de code ou de corpus n'a été appliqué et aucun smoke test catalogue/session/API/UI n'a été lancé après ce blocage. Une tâche distincte doit décider comment reconstruire/importer légitimement les versions 1 historiques avant la version publiée 2, sans contourner l'immuabilité ni la continuité des versions.

## DEV-003G — Diagnostic de la chaîne V1 vers V2

Le version gap est confirmé et intentionnel : les dix items publiés sont en version 2, la base staging ne contient aucune version 1, et `SqliteMcqCorpusWriter` exige qu'un nouvel item commence à 1 puis progresse sans trou.

Une projection historique locale existe : `docs/content/SNC-QCM-PILOT-V4.mcq-corpus.json`, corpus version 4, dix items `SNC-001` à `SNC-010` en version 1 et statut `IN_REVIEW`. Son mapping confirme qu'elle est la première projection éditoriale authentique des mêmes items. Elle n'est toutefois pas importable avec le contrat actuel : `source.sourceVersionId` contient l'alias `SNC-COURS-2026-04-28/V1`, alors que `MCQ_CORPUS/1` exige un UUID et que la FK SQLite exige une vraie `source_version`.

Les trois backups vérifiés disponibles en schéma v14/v15 ont été contrôlés en lecture seule :

- `BKP-20260821001339222-ea2d3a18` — v14 — aucune version SNC ;
- `BKP-20260829141439678-0bd823f5` — v14 — aucune version SNC ;
- `BKP-20260830011345266-06c4eac2` — v15 — aucune version SNC.

Aucune chaîne persistée V1 ne peut donc être restaurée. L'option D est retenue pour cette mission. Le prérequis manquant est une projection technique V1 distincte et explicitement tracée, conservant le contenu historique mais résolvant l'alias vers un UUID source valide. Sa création nécessite une autorisation dédiée ; aucune modification de corpus, import ou écriture SQLite n'a été effectuée par DEV-003G.

## DEV-003H — Reconstruction contrôlée V1 vers V2

La V1 éditoriale originale a été préservée. Une projection technique distincte, `docs/content/SNC-QCM-PILOT-V4-V1-IMPORTABLE.mcq-corpus.json`, remplace uniquement l'alias source par le UUID résolu `8fdf1a28-6025-4846-a74b-1b4faca1d98f`. Le fichier de mapping associé documente l'alias, le UUID et le checksum identique `1e194e6192ea11b3f8a33fce78fdd4ffa332b83f1f9b38e1836b57fdac39c273`. La comparaison structurée confirme qu'aucun contenu pédagogique ni statut/version V1 n'a changé.

Le dry-run V1 a retourné `VALIDATED_NOT_IMPORTED` pour 10 items. Le backup officiel `BKP-20260830012137084-40b41715` a été vérifié avant écriture. L'import V1 a créé 10 versions 1, puis le dry-run V2 a réussi et l'import V2 a créé 10 versions 2. L'état final contient exactement dix versions 1 et dix versions 2, `latest_version=2` pour les dix items, zéro doublon et zéro provenance V2 divergente. `integrity_check=ok`.

Le smoke test moderne a confirmé : catalogue `PEBC-PART-I-2026` à 10 items, session synthétique de 10 questions, ownership positif et refus d'un autre apprenant, quatre options, aucune clé/explication avant réponse, soumission acceptée, correction et explication après réponse, puis question suivante disponible. Le smoke UI n'a pas été exécuté car il aurait nécessité une session Auth0 locale.

L'idempotence V2 a été vérifiée sans second import réel : l'état persisté correspond à la version importée, les contraintes d'unicité ne montrent aucun doublon et le writer traite une version strictement identique comme `UNCHANGED` sans réécriture.

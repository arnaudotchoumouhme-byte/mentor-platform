# Correctif ciblé de l’import documentaire

Branche : `codex/document-import-reliability`, issue de `cc548ce2679c312b84448034b0c8da0787c22b4e` (correctif Settings préexistant). Aucun push, déploiement ni accès en écriture à Render.

## Diagnostic

- CURRENT_DUPLICATE_SCOPE = learner avant correction.
- SQL_UNIQUE_CONSTRAINT = index `sources_user_upload_checksum` sur `(workspace_id, checksum)`, pour les sources USER_UPLOAD non supprimées.
- SCOPE_MISMATCH_CONFIRMED = OUI.
- JOURNAL_STORES_LEARNER_ID = NON dans le schéma v19 et l’ancien INSERT.
- RECOVERY_CAN_LOSE_LEARNER = OUI avant correction : `recover()` relit le journal, dont l’identité n’était jamais persistée.
- La trace production ne journalisait que INTERNAL_ERROR. Le conflit était déduit de la contrainte, des lignes présentes et du chemin de finalisation ; aucune exception brute n’a été prétendue observée.

## Correction

La recherche de doublons porte désormais sur le workspace et lit l’ownership existant. Même propriétaire : doublon déterministe. Autre propriétaire ou document sans ownership : FILE_DUPLICATE / HTTP 409, message générique, sans mutation ni divulgation d’identité. La contrainte globale et le modèle mono-propriétaire restent inchangés. Aucun partage implicite.

La finalisation vérifie à nouveau le doublon sous BEGIN IMMEDIATE, pour couvrir une insertion concurrente après le précontrôle. Un conflit connu annule la transaction et compense uniquement les artefacts de la nouvelle tentative. Une erreur SQLite non classifiée conserve les artefacts nécessaires à une reprise, avec l’identité persistée.

L’identité apprenant est vérifiée avant stockage, persistée dans le journal et utilisée pendant la finalisation/reprise. Un ancien journal sans identité fiable, avec fichier final présent, est laissé intact. Une reprise avec compte absent ou source déjà existante est également laissée à la réconciliation opérateur. Aucun ownership n’est déduit du nom, du checksum ou de la session ayant déclenché la reprise.

## Migration locale additive

Après inspection du registre (dernier numéro existant : MIG-0019), ajout de MIG-0020 : colonne nullable `document_import_journal.learner_id TEXT REFERENCES accounts(learner_id) ON DELETE RESTRICT`. Les anciennes lignes gardent NULL ; aucun backfill. Les définitions MIG-0001 à MIG-0019 restent inchangées. Le registre, bootstrap, preflight et attentes des tests de version courante passent à v20. Les tests de schémas futurs utilisent v21.

Checksum canonique calculé : `3a97591ccf3ee31b317551261de0b492863cd18b59266919a399f76111f15d8e`.

Migration testée uniquement sur base synthétique. Ne pas déployer ce runtime sur la base Render v19 sans une mission distincte de migration contrôlée, avec backup vérifié et autorisation exacte. Aucun rollback automatique ni modification de migration historique. Pour abandonner le correctif avant déploiement, retirer ce commit local ; après migration réelle, tout retour doit faire l’objet d’une procédure opérateur distincte.

## Résidu production — procédure séparée, non exécutée

Dernière observation read-only : `aac63838-6ab5-4140-ad52-5d661bb3bf44`, journal pending sans document_id, fichier final de 52 326 octets, aucune source/version correspondante. Le checksum correspond au document 10 / source `5837678a-5d26-4970-844c-3179915e55eb`, à préserver. Il s’agit du PDF PRE-01 SNA (11 pages), pas du PDF historique SNC de 49 pages.

Avant un cleanup autorisé : fenêtre sans écritures, backup vérifié, nouvelle lecture des références par storage_id/source_id/source_version_id, checksum du fichier et état du journal. Si une référence nouvelle apparaît : arrêter. Sinon préparer la suppression ciblée de ce seul fichier résiduel et de cette seule ligne pending, avec audit opérateur ; ne pas modifier document 10, documents 2/7, sources valides ni ownership. Cette opération nécessite une autorisation distincte et n’est pas exécutée par le correctif.

## Validation

Tests initiaux ciblés : 24/24 PASS. Contrôle élargi intermédiaire : 191 PASS, 11 FAIL (8 timeouts à 5 s, 3 assertions liées à v20 corrigées ensuite). Aucun timeout augmenté et aucun test supprimé. Les checks finaux sont consignés ci-dessous après leur achèvement.

Le redesign du partage documentaire reste reporté. QCM, flashcards, progression, Auth0, Vercel, Render et MLE éditorial ne sont pas modifiés.

## Résultats finaux observés

- Contrôle ciblé final (10 fichiers, `vitest run ... --maxWorkers=1`) : **84 PASS, 2 FAIL / 86**, 167,92 s. Échecs : extraction de la fixture DOCX (`L’extraction du document a dépassé la durée autorisée`, environ 20 s) ; restauration staging synthétique (`Test timed out in 10000ms`, environ 10,96 s). Les assertions corrigées de version/identité ne produisent plus d’échec dans ce contrôle. Ces deux timeouts ne sont pas établis comme préexistants par une comparaison sur main.
- Suite globale, exécutée une seule fois avant les derniers ajustements de fixtures : **751 PASS, 8 FAIL, 1 SKIPPED / 760**, 430,96 s. Sept échecs portaient sur les fixtures/attentes de schéma et identité corrigées ensuite ; le huitième est le timeout MIG-0017 à 5 s déjà observé sur main dans les gates antérieurs. Aucun PASS global final n’est revendiqué.
- Typecheck : **PASS**, dernier passage après ajustement des fixtures.
- Lint complet : **PASS** ; contrôle des dernières fixtures modifiées : **PASS**.
- Build officiel `pnpm run build` : **PASS**, code 0. Les derniers changements ultérieurs concernent les tests et le présent rapport.
- `git diff --check` : **PASS**. Aucune définition historique MIG-0001 à MIG-0019 modifiée.

SAFE_FOR_PREVIEW = NON
SAFE_FOR_PRODUCTION_AFTER_PREVIEW = NON

Blocages : deux timeouts ciblés non résolus, absence de gate global final vert. La mise en production nécessitera en outre une autorisation distincte pour MIG-0020, le traitement séparé du résidu et une validation Preview. Aucun push, déploiement, nettoyage Render ou migration réelle effectué. Le correctif reste local et non commité tant que ces gates restent en échec.

## Clôture après reprise des validations

Sans aucune modification supplémentaire du code ni des délais : les deux fichiers auparavant en timeout passent isolément (**12/12**, 15,06 s). Les timeouts ne se reproduisent pas ; la lenteur ponctuelle de l’environnement est une hypothèse, non une cause démontrée.

Une validation globale finale de l’état corrigé, sans autre gate concurrent, termine avec **761 PASS, 1 SKIPPED, 0 FAIL**, **152 fichiers PASS**, **479,15 s**, commande `node node_modules/vitest/vitest.mjs run --maxWorkers=1`. Aucun timeout signalé. Ce résultat remplace le statut global bloquant précédent, conservé ci-dessus pour traçabilité.

Typecheck, lint et build : PASS conservés, aucun code modifié depuis leurs derniers passages. Diff check final : PASS.

SAFE_FOR_PREVIEW = OUI — environnement synthétique isolé, schéma v20.
SAFE_FOR_PRODUCTION_AFTER_PREVIEW = NON — migration réelle MIG-0020, traitement du résidu et validation Preview non exécutés ; autorisations distinctes nécessaires.

Aucun push, aucune écriture Render, aucun cleanup ni déploiement. La branche hérite du correctif Settings ; le commit dédié ne contient que le présent correctif d’import et ses adaptations de tests.

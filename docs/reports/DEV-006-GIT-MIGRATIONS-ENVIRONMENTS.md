# DEV-006 — Git, migrations et environnements

## Objectif et périmètre

Réconcilier l'arbre local, la chaîne MIG-0001→MIG-0016 et les environnements sans commit, push, déploiement ni accès à `data/mentor.db`. Branche `main`, HEAD `7bcd6d9b2d64f2a78b83583c6331f09c23868be0`, synchronisée avec `origin/main` (`0 0`).

## État Git

- Aucun conflit, index non modifié et travail DEV-003/004/005 préservé.
- 71 entrées suivies modifiées et 53 entrées non suivies au contrôle initial.
- Les ensembles protégés `.tmp-migration-runner/`, `DOCS1/`, `backups/`, `content-sources/`, `dossier evolution/`, `mentor-platform-restaure/` et `data/` restent exclus.
- `git diff --check` : PASS, avec uniquement les avertissements LF→CRLF connus.

## Migrations

Le registre contient exactement 16 migrations continues et ordonnées : MIG-0001 0→1 jusqu'à MIG-0016 15→16. Aucun doublon, trou ou migration supérieure à MIG-0016. La staging autorisée est en version 16 et son `integrity_check` est `ok`. Le build n'importe pas le runtime DB et n'exécute aucune migration.

## Environnements

| Environnement | DB et comportement |
| --- | --- |
| Local development | `MENTOR_DATA_DIRECTORY` absolu recommandé ; bootstrap d'une DB absente autorisé dans cet emplacement ; base existante obsolète bloquée sans migration implicite. |
| Local preview/staging | chemin temporaire explicite ; migrations uniquement via activation contrôlée. |
| Render build | `NEXT_PHASE=phase-production-build` ; aucune ouverture, création, migration ou vérification physique du mount. |
| Render runtime | `/opt/render/project/src/persistent/data/mentor.db` ; contrôle physique du disque avant `next start`, puis ouverture/readiness ; échec fermé si configuration ou schéma invalide. |

Il n'existe pas de fallback silencieux utilisable au runtime Render : le prestart refuse un chemin absent, hors mount, overlay, tmpfs, ramfs ou non inscriptible avant SQLite.

## Groupes de commits proposés

1. BUILD/RUNTIME + readiness et preuves DEV-007.
2. TOOLING TypeScript/pnpm/esbuild.
3. MCQ content/SNC + MIG-0014, puis alias/provenance + MIG-0015 selon un séquençage contrôlé du registre.
4. UI + élimination des chargements infinis DEV-004.
5. Learner isolation + MIG-0016 + rapport DEV-005.

## Modifications et contrôles

DEV-006/007 a seulement corrigé `schemaVersion: 15` en `16` dans un test backup obsolète, ajouté un test synthétique de persistance après réouverture et créé les deux rapports DEV-006/007. Aucun code de production, migration ou donnée métier n'a été modifié.

Verdict : **DEV-006 PASS**.

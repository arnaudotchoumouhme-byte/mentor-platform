# DEV-007 — Render, persistance et readiness

## Objectif et architecture

Valider localement l'architecture cible sans accès distant ni déploiement : un Web Service stateful, une seule instance, un Persistent Disk monté sur `/opt/render/project/src/persistent`, SQLite sous `/opt/render/project/src/persistent/data/mentor.db`.

## Build et runtime

- Build : `src/instrumentation.ts` ignore explicitement `phase-production-build`; `src/lib/db.ts` est paresseux. Le test d'import de `/api/actions` prouve qu'aucun répertoire ni fichier SQLite n'est créé.
- Prestart : `scripts/check-persistent-storage.mjs` rend le disque obligatoire en production Render même si le flag est absent ; il refuse mount absent, overlay, tmpfs, ramfs, chemin hors mount et absence d'écriture.
- Runtime : la DB n'est ouverte qu'après le contrôle prestart. Une DB existante obsolète est inspectée et bloquée ; aucune migration implicite n'est exécutée.
- Instance unique : exigence explicite dans `docs/deployment/PILOT-WEB-DEPLOYMENT.md`; aucun scaling horizontal SQLite n'est autorisé.

## Readiness

La liveness `/api/health` reste indépendante. `/api/readiness` n'est positive que si stockage, DB, schéma courant v16, absence de migration pending et Auth0 sont prêts. Les erreurs de stockage, DB, schéma et migration donnent un état `not-ready` sans secret.

## Persistence, backup et restore

- Réouverture du même chemin temporaire : donnée synthétique préservée et intégrité `ok`.
- Backup : manifeste, checksum, version et intégrité vérifiés par `SqliteBackupService`.
- Restore : uniquement vers un nouveau staging ; refus d'écraser la source ou une destination existante ; donnée synthétique et readiness préservées.
- Aucun backup Render distant et aucun remplacement de base active.

## Contrôles exécutés

- 8 fichiers de tests ciblés uniques, 47/47 tests réussis.
- `app-config`, séparation build/runtime, stockage Render, readiness, startup DB, registre/readiness migrations, backup/restore et persistance après redémarrage couverts.
- ESLint ciblé des deux tests modifiés/créés : PASS.
- Build complet : non relancé ; le mécanisme de production n'a pas changé et le test de frontière build fournit la preuve ciblée requise.
- Auth0 : contrat obligatoire vérifié sans afficher de valeur ; placeholders synthétiques uniquement.
- `data/mentor.db` non ouverte ; staging v16 uniquement lue, sans écriture DEV-007.

## Risques et exploitation

Le Persistent Disk et le nombre d'instances restent des paramètres Render Dashboard : ils doivent être vérifiés opératoirement avant déploiement. Le runtime échoue fermé s'ils sont absents ou invalides. Aucun secret manifeste n'a été trouvé dans les fichiers de configuration pertinents.

Verdict : **DEV-007 PASS**, capacité de déploiement validée localement, sans déploiement effectué.

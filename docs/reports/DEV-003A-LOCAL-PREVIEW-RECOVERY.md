# DEV-003A — Rétablir la base locale de prévisualisation

## Objectif et périmètre

Identifier, sans écriture, une base locale de prévisualisation existante ou une sauvegarde vérifiée permettant de reconstruire la cible configurée :

`C:\Users\otcho\AppData\Local\Temp\mentor-local-preview\mentor.db`

## Résultat

**WAITING_AUTHORIZATION — cas B.**

Aucune base de prévisualisation existante n'a été trouvée dans le répertoire configuré ni parmi les fichiers `mentor*.db`/`mentor*.sqlite` recherchés sous `C:\Users\otcho\AppData\Local\Temp`.

Le backup historique `BKP-20260821001339222-ea2d3a18` existe et a été vérifié avec le mécanisme officiel `SqliteBackupService.verify()`.

## Restore candidate

- **RESTORE CANDIDATE** : backup contrôlé pré-MIG-0015 de `mentor.db` ;
- **BACKUP ID** : `BKP-20260821001339222-ea2d3a18` ;
- **SOURCE** : identité manifeste `SQLITE_FILE`, fichier source `mentor.db` ; le contexte historique fourni l'associe à la preview locale, tandis que le manifeste ne conserve pas le chemin absolu ;
- **PACKAGE** : `C:\Users\otcho\Documents\MENTOR PLATEFORME\backups\BKP-20260821001339222-ea2d3a18` ;
- **CREATED AT** : `2026-08-21T00:13:39.222Z` ;
- **DESTINATION PROPOSÉE** : `C:\Users\otcho\AppData\Local\Temp\mentor-local-preview-recovery\mentor-staging-v14.db` ;
- **SCHEMA VERSION** : `14` ;
- **CHECKSUM STATUS** : PASS ;
- **CHECKSUM SHA-256** : `73ae2773c74c6437f7ba59fea7b7172617753926be59757cd5939a68fe8c1079` ;
- **MANIFEST** : `COMPLETE`, format 1, application `1.0.0` ;
- **OFFICIAL VERIFICATION** : `VERIFIED` ;
- **INTEGRITY** : PASS, vérifiée par `SqliteBackupService.verify()` ;
- **PERTINENCE** : point de récupération v14 approprié avant MIG-0015 ; il faudra ensuite une validation du staging et une activation contrôlée séparée de MIG-0015 pour obtenir une preview v15.

## Procédure sûre proposée

Après autorisation humaine :

1. appeler uniquement `SqliteBackupService.restoreToStaging()` vers le nouveau fichier proposé ;
2. vérifier checksum, `integrity_check`, historique et schéma v14 du staging ;
3. ne pas remplacer ou promouvoir automatiquement le staging ;
4. demander une décision humaine distincte pour faire de ce fichier la base locale configurée ;
5. préparer ensuite MIG-0015 avec `ControlledMigrationActivation.prepare()` et obtenir une autorisation distincte avant `execute()`.

Cette séquence évite toute restauration directe non vérifiée vers la cible active et respecte les runbooks `RUN-BACKUP.md` et `RUN-DB.md`.

## Recherche et commandes exécutées

- lecture des rapports DEV-002 et DEV-003 ;
- recherche ciblée des références à `restoreToStaging`, `SqliteBackupService`, preview et activation contrôlée ;
- inventaire en lecture seule des bases candidates sous le répertoire Temp et des manifests sous `backups/` ;
- vérification officielle du package avec :

```powershell
pnpm run tsx --eval "... new SqliteBackupService().verify('C:/Users/otcho/Documents/MENTOR PLATEFORME/backups/BKP-20260821001339222-ea2d3a18') ..."
```

Résultat officiel : `status = VERIFIED`, schéma 14 et checksum concordant.

Une première invocation de vérification a échoué avant lecture du backup parce que `tsx --eval` ne supportait pas le `top-level await` dans sa sortie CJS. Elle a été répétée avec une fonction asynchrone encapsulée ; aucun fichier ni aucune base n'a été modifié par cet échec d'outillage.

## Interdictions respectées

- `data/mentor.db` n'a pas été ouverte ni interrogée ;
- aucune restauration, création de DB ou migration ;
- aucun import SNC, ingestion ou changement d'alias ;
- aucune opération Render ou production ;
- aucun changement de code, commit, push, merge ou déploiement.

## Autorisation requise

Autorisation humaine requise pour restaurer ce backup **uniquement vers** :

`C:\Users\otcho\AppData\Local\Temp\mentor-local-preview-recovery\mentor-staging-v14.db`

avec `SqliteBackupService.restoreToStaging()`. La promotion vers la cible configurée et MIG-0015 restent hors de cette autorisation et devront être décidées séparément.

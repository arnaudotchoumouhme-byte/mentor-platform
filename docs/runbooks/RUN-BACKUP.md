# RUN-BACKUP — Sauvegarde et restauration

## Symptômes

Backup absent, checksum divergent, manifeste incomplet, version source inattendue ou post-validation en échec.

## Procédure

1. Relever `traceId`, `backupId`, version source et statut sans copier de données utilisateur dans les logs.
2. Exiger un manifeste `COMPLETE`, checksum concordant, empreinte source concordante et `integrity_check=OK`.
3. Ne jamais déduire qu'un backup est valide de la seule présence du fichier.
4. Restaurer uniquement avec `SqliteBackupService.restoreToStaging()` vers un nouveau fichier.
5. Vérifier staging, puis demander une décision humaine avant tout remplacement de la base active.

Une erreur de backup/migration est critique et non réparable automatiquement.

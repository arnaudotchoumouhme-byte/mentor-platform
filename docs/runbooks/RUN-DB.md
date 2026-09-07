# RUN-DB — Persistance et migrations

## Symptômes et codes

- Service indisponible : `DB_STARTUP_FAILED` ou `DB_NOT_READY`.
- Version inférieure : `DB_SCHEMA_OUTDATED` — préparer une activation contrôlée; aucune migration implicite.
- Version supérieure : `DB_SCHEMA_AHEAD` — arrêter et vérifier la version applicative.
- Historique/checksum incohérent : `DB_MIGRATION_HISTORY_INVALID` — préserver la base et le backup, ne pas réparer manuellement.
- Mise à jour de quota impossible : `DB_QUOTA_UPDATE_FAILED` — opération retriable après vérification SQLite.

## Contrôle

1. Relever `traceId`, heure, version déployée et code stable depuis l'UI ou `/api/readiness`.
2. Filtrer les logs JSON sur ce `traceId`; identifier le premier événement `failure`.
3. Vérifier le Persistent Disk et les permissions avant toute lecture DB.
4. Utiliser uniquement le preflight contrôlé pour connaître version, intégrité, historique et migrations en attente.
5. En cas d'anomalie, conserver la base active et les backups; utiliser `restoreToStaging()` seulement vers un nouveau fichier.

## Activation contrôlée d'une migration

Cette commande est exclusivement opérateur et ne fait partie ni du build, ni du démarrage ordinaire, ni du déploiement. En production Render, les chemins doivent être absolus, rester sur le Persistent Disk configuré, et la base doit être exactement `${MENTOR_DATA_DIRECTORY}/mentor.db`.

Phase A — préparer le plan et un backup vérifié :

```powershell
pnpm run db:migration -- prepare --database=/opt/render/project/src/persistent/data/mentor.db --backup-destination=/opt/render/project/src/persistent/backups --request-output=/opt/render/project/src/persistent/migration-requests/mig-0017.json --application-version=<DEPLOY_SHA> --backup-intent=I_AUTHORIZE_MENTOR_DATABASE_BACKUP
```

Le dossier parent de `--request-output` doit déjà exister et le fichier ne doit pas exister. La préparation exécute le preflight officiel en lecture seule, lie le plan à l'identité et à l'empreinte exactes de la base, puis crée et vérifie le backup avec le service existant lorsqu'il est requis. Elle affiche un résumé JSON sans secret : versions, migrations en attente, identifiants du plan et du backup, échéance et chemin du fichier de requête.

Une autorisation humaine séparée est ensuite consignée pour cette requête exacte dans un fichier JSON protégé contenant les valeurs produites par la préparation :

```json
{
  "activationId": "<activationId>",
  "databaseIdentityHash": "<databaseIdentity.identityHash>",
  "migrationPlanHash": "<migrationPlanHash>",
  "backupId": "<backupId-ou-null>",
  "approvedAt": "<horodatage-ISO-compris-entre-createdAt-et-expiresAt>",
  "approvalIntent": "I_AUTHORIZE_MENTOR_DATABASE_MIGRATION"
}
```

Phase B — appliquer uniquement la requête autorisée :

```powershell
pnpm run db:migration -- apply --database=/opt/render/project/src/persistent/data/mentor.db --request=/opt/render/project/src/persistent/migration-requests/mig-0017.json --authorization=/opt/render/project/src/persistent/migration-requests/mig-0017.authorization.json
```

L'application échoue fermée si l'autorisation exacte manque, est expirée (fenêtre de 15 minutes), vise une autre base ou un autre plan, si la base a changé depuis la préparation, ou si le backup n'est plus vérifiable. La commande ne remplace jamais une autorisation humaine séparée et n'accepte aucun équivalent générique tel que `--yes`, `--force` ou `--migrate`.

## Interdictions

Pas de SQL manuel, migration implicite, remplacement automatique de la base active, log de requête sensible ou fallback éphémère.

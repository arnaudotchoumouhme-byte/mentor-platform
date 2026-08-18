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

## Interdictions

Pas de SQL manuel, migration implicite, remplacement automatique de la base active, log de requête sensible ou fallback éphémère.

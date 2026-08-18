# RUN-DEPLOY — Render

## Checks rapides

1. `/api/health` doit répondre 200 : processus HTTP vivant.
2. `/api/readiness` doit répondre 200 : runtime réellement prêt.
3. En 503, relever le `traceId` et le check en échec.
4. `FS_PERSISTENT_STORAGE_NOT_MOUNTED` : attacher le disque au mount documenté; aucun fallback.
5. `CFG_AUTH0_INCOMPLETE` : corriger uniquement les variables Render; ne jamais afficher leur valeur.
6. `CFG_PILOT_PROVISIONING_INCOMPLETE` : compléter allowlist, quotas et clé d'audit.
7. Codes DB : appliquer `RUN-DB`; aucune migration automatique.

Ne jamais déployer en activant les données de démonstration, journaliser des secrets ou provisionner publiquement un compte.

# RUN-APP-START — Pourquoi Mentor ne démarre-t-il pas ?

1. Vérifier `node --version` : Node 24 minimum.
2. Vérifier `pnpm.cmd --version`; préparer pnpm 11.9.0 avec Corepack si nécessaire.
3. Exécuter `pnpm.cmd install --frozen-lockfile`.
4. Copier `.env.example` vers `.env.local` sans secret non requis.
5. Vérifier que le port 3000 est libre, puis lancer `pnpm.cmd dev`.
6. Vérifier `http://localhost:3000/api/health`.
7. Vérifier `/api/readiness` : HTTP 200 signifie que stockage, DB, schéma, migrations, Auth0 et composants indispensables sont prêts; HTTP 503 impose de relever le `traceId` et le check en échec.

- `pnpm.ps1 cannot be loaded` : utiliser `pnpm.cmd`, sans désactiver globalement la sécurité PowerShell.
- Lockfile incohérent : ne pas contourner `--frozen-lockfile`; examiner le diff.
- Erreur TypeScript : lancer `pnpm.cmd run typecheck` et corriger la première cause réelle.
- Cache Next suspect : arrêter l’application et supprimer uniquement `.next/`, jamais `data/` ou `storage/`.
- Avertissement workspace/Turbopack : vérifier `pnpm-workspace.yaml` et `turbopack.root`.
- Base non prête : conserver le code d’erreur ; ne pas éditer manuellement la base.

Le health check confirme le processus HTTP, pas le fonctionnement du RAG ou des données.

`/api/health` est une liveness. `/api/readiness` est la preuve non sensible de capacité à servir le pilote. Codes critiques : `FS_PERSISTENT_STORAGE_NOT_MOUNTED`, `CFG_AUTH0_INCOMPLETE`, `CFG_PILOT_PROVISIONING_INCOMPLETE`, `DB_NOT_READY`, `DB_SCHEMA_OUTDATED`, `DB_SCHEMA_AHEAD`, `DB_MIGRATION_HISTORY_INVALID`. Ne jamais contourner un échec de readiness par un fallback éphémère ou une migration implicite.

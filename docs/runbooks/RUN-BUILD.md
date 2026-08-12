# RUN-BUILD — Échecs des quality gates

```powershell
pnpm.cmd run check:node
pnpm.cmd run typecheck
pnpm.cmd run lint
pnpm.cmd run test
pnpm.cmd run build
```

- **Typecheck** : vérifier qu’une copie de restauration n’entre pas dans les `include`.
- **Lint** : corriger le premier fichier applicatif ; ne pas convertir les règles en warnings.
- **Dépendances** : relancer l’installation figée. Un échec signale package/lockfile ou réseau/cache.
- **Node mismatch** : utiliser Node 24 minimum.
- **Build** : distinguer compilation, typecheck, collecte et génération des routes.
- **SQLite locked** : arrêter les autres processus Mentor et relancer ; ne pas supprimer la base.
- **Workers de build** : `experimental.cpus: 1` est intentionnel tant que le bootstrap SQLite est évalué lors du chargement des routes.
- **Turbopack/workspace** : la racine est celle de `package.json` et `pnpm-lock.yaml`, explicitée dans `next.config.ts`.

Conserver la sortie, la branche et le SHA. Ne jamais utiliser `skip`, `ts-ignore` ou une désactivation ESLint massive pour obtenir un résultat vert.

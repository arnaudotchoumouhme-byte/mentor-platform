# Mentor PEBC

Application d’apprentissage locale, Windows-first, construite avec Next.js, TypeScript et SQLite. Le dépôt évolue vers PEBC Learning OS selon les documents normatifs de `dossier evolution/`.

## Prérequis et installation

- Windows 10/11
- Node.js 24 ou plus récent
- pnpm 11.9.0, déclaré dans `package.json`

```powershell
corepack enable
corepack prepare pnpm@11.9.0 --activate
pnpm.cmd install --frozen-lockfile
Copy-Item .env.example .env.local
pnpm.cmd dev
```

Si PowerShell bloque `pnpm.ps1`, utilisez `pnpm.cmd`; n’affaiblissez pas la stratégie d’exécution. Ouvrez ensuite `http://localhost:3000`. `start-mentor.cmd` automatise les vérifications locales.

## Configuration

| Variable | Requise | Usage |
|---|---:|---|
| `OPENAI_API_KEY` | non | réservée à un futur provider serveur |
| `AI_DAILY_BUDGET_CAD` | non | budget configuré, défaut `2.00` |
| `MENTOR_ENABLE_DEMO_DATA` | non | `1` charge les exemples au premier démarrage ; `0` crée une base vide |
| `MENTOR_DATA_DIRECTORY` | non | chemin absolu pour isoler une exécution technique |

Les données utilisateur sont dans `data/` et `storage/`, ignorés par Git. Les exemples synthétiques sont dans `src/demo/` et identifiés par `[DÉMO]`.

## Quality gates

```powershell
pnpm.cmd run typecheck
pnpm.cmd run lint
pnpm.cmd run test
pnpm.cmd run test:coverage
pnpm.cmd run build
pnpm.cmd run verify
pnpm.cmd run start
```

Le health check non sensible est disponible sur `/api/health`.

## Limites

L’extraction complète PDF/DOCX, l’OCR, le chunking, les embeddings et le RAG final appartiennent aux lots suivants. Le moteur local actuel n’est ni un LLM ni un RAG sémantique complet. SQLite et le stockage local ne sont pas adaptés tels quels à Vercel ou à un SaaS multi-utilisateur.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Contribution](CONTRIBUTING.md)
- [Démarrage](docs/runbooks/RUN-APP-START.md)
- [Build](docs/runbooks/RUN-BUILD.md)
- [Import documentaire](docs/runbooks/RUN-IMPORT.md)
- [Module Library](docs/modules/library.md)
- [Pipeline d’ingestion](docs/modules/ingestion.md)
- Documents normatifs : `dossier evolution/`

Le LOT 2 extrait localement PDF textuels, DOCX, TXT et Markdown. Les fichiers utilisent un UUID interne sous `MENTOR_DATA_DIRECTORY`; le nom utilisateur reste une métadonnée. Un PDF sans couche texte est classé `REQUIRES_OCR`. Aucun embedding, RAG ou appel LLM n’est effectué.

Ne modifiez jamais directement les fichiers de données utilisateur pour diagnostiquer un problème.

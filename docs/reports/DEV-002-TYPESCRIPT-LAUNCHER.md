# DEV-002 — TYPESCRIPT LAUNCHER

Date : 2026-08-29

Branche : `main`

HEAD : `7bcd6d9b2d64f2a78b83583c6331f09c23868be0`

## Résumé

Les scripts TypeScript d'exploitation démarrent de nouveau sur l'environnement Windows audité. La politique pnpm était déjà corrigée de façon ciblée avant DEV-002 : `esbuild@0.25.12` est explicitement autorisé et `pnpm ignored-builds` retourne `None`. Le blocage restant était indépendant de l'installation : Node.js 24.19.0 échoue sur `os.userInfo()` avec `uv_os_get_passwd / ENOMEM`, appel utilisé par `tsx` pour nommer un canal temporaire.

La correction ajoute un lanceur étroit qui précharge un shim uniquement dans les processus `tsx`. Le shim intervient exclusivement pour l'erreur exacte `ERR_SYSTEM_ERROR` associée au syscall `uv_os_get_passwd`, puis fournit à `tsx` le nom d'utilisateur déjà disponible dans l'environnement et le home retourné normalement par `os.homedir()`. Toute autre erreur est relancée sans altération.

Résultat : `tsx`, le mode non destructif de `source-version-alias` et le dry-run `mcq:import` fonctionnent. Aucun import, alias, migration ou fichier SQLite n'a été créé.

## Cause racine

Deux incidents distincts avaient été confondus :

1. **ERR_PNPM_IGNORED_BUILDS** : `tsx@4.20.6` dépend légitimement d'`esbuild~0.25.0`, résolu par le lockfile en `esbuild@0.25.12`. pnpm avait initialement ignoré son script d'installation. La configuration locale préexistante `allowBuilds.esbuild: true` corrige ce point sans autorisation globale.
2. **uv_os_get_passwd / ENOMEM** : après installation cohérente, `tsx` échouait encore avant l'exécution du script. La reproduction minimale `node -e "require('node:os').userInfo()"` échoue avec Node 24.19.0, alors que `os.homedir()` et `os.tmpdir()` réussissent. Cette erreur est donc indépendante d'esbuild et de l'installation.

`tsx` importe `os.userInfo().username` dans son module de répertoire temporaire. Lorsqu'il exécute un fichier TypeScript, son CLI crée un second processus Node et charge `preflight.cjs`. Le shim doit par conséquent être transmis par `NODE_OPTIONS --require`, avant ce preflight. Un simple patch appliqué seulement au processus parent ne suffit pas.

## Relation pnpm / esbuild / tsx

- package manager déclaré : `pnpm@11.9.0` ;
- pnpm disponible et utilisé pour la validation locale Codex : fallback officiel 11.19.0 ;
- le lanceur pnpm global Windows reste lent/bloqué sur cet hôte et n'a pas été modifié ;
- `tsx` : 4.20.6, verrouillé dans `pnpm-lock.yaml` ;
- `esbuild` : 0.25.12, dépendance directe de `tsx`, verrouillée avec ses paquets natifs optionnels ;
- exécutable natif vérifié : `@esbuild/win32-x64@0.25.12`, version retournée 0.25.12 ;
- `pnpm ignored-builds` : `None` ;
- portée d'autorisation : `esbuild` uniquement, `unrs-resolver` étant l'autorisation historique déjà présente ; aucune protection globale désactivée.

## Correction

### Fichiers modifiés par DEV-002

- `package.json` : les trois scripts utilisent le lanceur contrôlé `node scripts/run-tsx.mjs`. Les ajouts préexistants `tsx`, `mcq:import`, `source-version-alias` et la version de la dépendance sont préservés.

### Fichiers créés par DEV-002

- `scripts/run-tsx.mjs` : démarre le CLI officiel `tsx` dans un enfant, transmet les arguments sans les interpréter et impose le shim uniquement à ce processus et à ses enfants ;
- `scripts/tsx-windows-userinfo-shim.cjs` : fallback minimal pour l'erreur exacte Windows ; CommonJS est nécessaire car Node doit le charger avant `tsx/preflight.cjs` ;
- `scripts/tsx-windows-userinfo-shim.test.mjs` : test du vrai chemin enfant avec une expression TypeScript exécutée par `tsx` ;
- `docs/reports/DEV-002-TYPESCRIPT-LAUNCHER.md` : présent rapport.

### Fichiers vérifiés mais non modifiés par DEV-002

- `pnpm-workspace.yaml` : conserve `allowBuilds.esbuild: true`, correction ciblée déjà présente ;
- `pnpm-lock.yaml` : conserve `tsx@4.20.6` et `esbuild@0.25.12`, aucun changement de version ;
- `scripts/import-mcq-corpus.ts` et `scripts/source-version-editorial-alias.ts` : logique inchangée ;
- corpus SNC, migrations, base, code métier et autres groupes DEV-001 : inchangés.

## Validations exécutées

| Contrôle | Résultat |
|---|---|
| pnpm fallback `--version` | 11.19.0, PASS |
| `pnpm ignored-builds` | `None`, PASS |
| esbuild JS entry | 0.25.12, PASS |
| esbuild natif win32-x64 | 0.25.12, PASS |
| `pnpm run tsx --version` | `tsx v4.20.6`, Node 24.19.0, PASS |
| `node --test scripts/tsx-windows-userinfo-shim.test.mjs` | 1/1, PASS |
| alias non destructif avec base inexistante | `VALIDATED_NOT_ASSOCIATED`, PASS |
| dry-run corpus publié sans `--apply` | `VALIDATED_NOT_IMPORTED`, 10 items, PASS |
| ESLint ciblé sur les trois fichiers lanceur | exit 0, PASS |
| TypeScript complet | exit 0, PASS |
| `git diff --check` | exit 0, PASS ; avertissements LF→CRLF préexistants uniquement |

Le test a d'abord démontré que le préchargement ESM intervenait trop tard dans le processus enfant. Cette version intermédiaire a été remplacée ; seul le préchargeur CommonJS final subsiste.

## Dry-run MCQ et absence d'import

Corpus : `docs/content/SNC-QCM-PILOT-V4-PUBLISHED.mcq-corpus.json`.

Résultat exact :

```json
{"status":"VALIDATED_NOT_IMPORTED","schemaVersion":"MCQ_CORPUS/1","corpusId":"SNC-QCM-PILOT","corpusVersion":5,"itemCount":10}
```

Aucun `--apply` n'a été fourni. Dans ce chemin, le script valide et retourne avant toute construction de `DatabaseSync`.

La base configurée par `.env.local` est attendue sous `C:\Users\otcho\AppData\Local\Temp\mentor-local-preview\mentor.db`. Au moment du contrôle final, ce fichier est absent. Le dry-run ne l'a ni créé ni ouvert. Il y a donc **0/10 item SNC stocké à ce chemin** et aucune écriture de base effectuée par DEV-002. L'ancien contenu éventuel d'une base supprimée ne peut pas être interrogé.

## État final

- politique de build pnpm : saine et ciblée ;
- `tsx` : opérationnel via le lanceur du projet ;
- `uv_os_get_passwd / ENOMEM` : contourné uniquement pour `tsx`, cause système toujours reproductible avec `os.userInfo()` brut ;
- importer MCQ : lanceur et dry-run opérationnels ;
- alias : validation non destructive opérationnelle ;
- base configurée : absente, non créée ;
- écritures métier : 0 ;
- index Git : vide ;
- commit/push/deploy : aucun.

Risque résiduel : le pnpm global installé dans `%APPDATA%` ne répond pas de manière fiable dans cet environnement. Les validations ont utilisé le pnpm fallback Codex 11.19.0. Le projet déclare 11.9.0 ; une future stabilisation de l'outillage hôte pourra aligner cette installation, sans modifier le correctif `tsx`.

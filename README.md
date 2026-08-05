# Mentor PEBC

Application locale d’apprentissage par documents, construite à partir du PRD évolutif V5.0. Le MVP couvre la bibliothèque, la recherche, le professeur documentaire avec citations, les QCM, cas cliniques, flashcards, examens blancs, progression, lacunes, plan d’étude et paramètres.

## Démarrage sous Windows

Prérequis obligatoire : Node.js 24 ou une version plus récente. Vérifiez d’abord :

```powershell
node --version
```

Si Windows répond que `node` est introuvable, installez Node.js puis fermez et rouvrez PowerShell :

```powershell
winget install OpenJS.NodeJS.LTS
```

Activez ensuite pnpm avec Corepack :

```powershell
corepack enable
corepack prepare pnpm@11.9.0 --activate
```

Depuis le dossier du projet :

```powershell
pnpm install
pnpm dev
```

Attendez le message `Ready`, gardez la fenêtre PowerShell ouverte, puis ouvrez `http://localhost:3000`. Fermer la fenêtre arrête le serveur et rend immédiatement la page inaccessible.

Vous pouvez aussi utiliser le lanceur avec diagnostic intégré :

```powershell
.\start-mentor.cmd
```

La base SQLite est créée au premier démarrage dans `data/mentor.db`. Les fichiers importés sont conservés dans `storage/documents`. Ces deux dossiers sont exclus de Git.

## Commandes de qualité

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Intelligence artificielle

Le professeur fonctionne immédiatement en mode documentaire local : il recherche les passages indexés et cite les fichiers utilisés. Ce mode n’effectue aucun appel payant. Les clés de fournisseurs externes doivent être ajoutées côté serveur dans `.env.local`; elles ne doivent jamais être saisies dans l’interface ou commitées.

L’extraction complète des nouveaux PDF/DOCX et l’OCR sont signalés par les états `À indexer` et `OCR requis`. Les fichiers TXT et Markdown sont indexés immédiatement. Les exemples initiaux rendent tous les parcours démontrables dès le premier lancement.

## Sauvegarde et restauration

1. Arrêter l’application.
2. Copier ensemble les dossiers `data` et `storage` vers un emplacement protégé.
3. Pour restaurer, replacer ces deux dossiers avant de redémarrer.

Une sauvegarde applicative chiffrée et vérifiée reste un lot de durcissement avant diffusion multi-utilisateur.

## Limite de déploiement

Cette version est une application locale auto-hébergée. Elle écrit dans SQLite et dans `storage/`; elle ne doit pas être déployée telle quelle sur Vercel ou une autre plateforme serverless à disque éphémère. Une migration vers une base et un stockage persistants est nécessaire avant un déploiement cloud.

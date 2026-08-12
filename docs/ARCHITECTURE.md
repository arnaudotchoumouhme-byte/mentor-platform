# Architecture technique

## Fondations LOT 1

Le dépôt est un workspace pnpm mono-package, pas un monorepo. `pnpm-workspace.yaml` conserve les réglages pnpm et `turbopack.root` rend la racine applicative explicite. TypeScript et ESLint sont bornés aux sources du produit : les copies documentaires ou de restauration ne deviennent pas des applications implicites.

- `src/shared/errors` : erreur applicative indépendante de HTTP avec code, catégorie, sévérité, cause et contexte non sensible.
- `src/shared/observability` : identifiants de corrélation.
- `src/infrastructure/observability` : logger JSON serveur et redaction centralisée.
- `/api/health` : état minimal sans chemins ni secrets.
- `src/demo` : données synthétiques séparées, identifiées et désactivables.

Ces fondations sont progressives : le LOT 1 ne migre pas encore tous les flux et ne construit ni RAG final ni Coach clinique.

Le build Next.js utilise un seul worker (`experimental.cpus: 1`) parce que le bootstrap SQLite/migrations est volontairement mono-writer. Cette décision élimine les courses `DATABASE_BUSY` pendant l’évaluation parallèle des routes; elle pourra être retirée lorsque le build ne chargera plus la persistance au moment d’importer les modules.

## Décision

Monolithe modulaire Next.js App Router, TypeScript strict et SQLite via `node:sqlite`. Cette structure minimise l’exploitation locale, garde les secrets et l’accès fichier côté serveur, et sépare la présentation (`src/app`, `src/components`, `src/presentation`), l’application (`src/application`), le domaine (`src/domain`), l’infrastructure (`src/infrastructure`, `src/lib/db.ts`) et les contrats partagés (`src/shared`). Les routes API composent les cas d’utilisation avec leurs adaptateurs SQLite sans contenir de SQL.

## Flux documentaire

Import → validation extension/taille → stockage dans `storage/documents` → extraction immédiate pour TXT/MD ou état contrôlé pour PDF/DOCX/image → recherche locale → construction d’un contexte → réponse → citations.

## Sécurité

- validation Zod de toutes les actions JSON;
- liste blanche des extensions et limite de 50 Mo;
- noms de stockage neutralisés;
- clés absentes du client et exclues de Git;
- requêtes SQLite préparées;
- suppression soumise à confirmation;
- contenu documentaire traité comme donnée, jamais comme instruction.

## Évolution

Les routes API forment une frontière remplaçable. SQLite peut évoluer vers PostgreSQL, le stockage local vers un service objet et le profil implicite vers une authentification, sans réécrire les composants métier.

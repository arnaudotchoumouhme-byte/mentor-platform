# Architecture technique

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

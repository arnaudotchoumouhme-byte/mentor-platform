# CODEX GUARDRAILS

Référence permanente pour les missions Codex du projet MENTOR PLATEFORME.

## A. Protection des données

- `data/mentor.db` est une donnée utilisateur protégée : aucune ouverture, interrogation, modification ou migration sans mission explicitement autorisée.
- Toute migration réelle exige : preflight, backup vérifié, autorisation humaine explicite, migration contrôlée et post-validation.
- Les tests SQLite utilisent exclusivement une base temporaire, synthétique ou `:memory:`.

## B. Git

- Utiliser une branche par lot fonctionnel lorsque nécessaire.
- Interdiction de `git add .` et `git add -A`; indexer explicitement les fichiers autorisés.
- Aucun force push, aucun rebase de `main` et aucune résolution automatique d'un conflit inattendu.
- Merge et push uniquement sur autorisation explicite.

## C. Périmètre protégé

Exclure sauf mission explicite :

- `.tmp-migration-runner/`
- `DOCS1/`
- `backups/`
- `dossier evolution/`
- `mentor-platform-restaure/`
- `docs/reports/RAPPORT-ETAT-DEVELOPPEMENT.md`
- `data/`

## D. Architecture

Respecter le flux `domain → application → infrastructure → presentation` et préserver les ports/adapters.

Le domaine ne dépend jamais de SQLite, Next.js, React, OpenAI ou de l'infrastructure. Aucun refactor opportuniste.

## E. Migrations

- Les migrations historiques sont immuables.
- Préférer les nouvelles migrations additives et exiger des tests synthétiques.
- Aucune activation automatique sur une base utilisateur.
- Ne jamais inventer une migration pour contourner un problème.

## F. Tests économiques

- Pendant le développement : tests ciblés uniquement.
- En fin de lot : typecheck, lint, tests globaux une seule fois; build une seule fois si le lot touche runtime, API, UI ou build, ou si la mission l'exige.
- Ne pas répéter un gate déjà vert si aucun fichier concerné n'a changé.

## G. Consommation Codex

- Lire uniquement les fichiers nécessaires et cibler les revues avec `git diff`.
- Ne pas auditer tout le dépôt sans demande explicite et éviter les recherches globales répétées.
- Ne pas répéter inutilement les tests; produire un rapport final court.
- Arrêter immédiatement sur anomalie bloquante.

## H. Définition de Done

Un lot est terminé lorsque son périmètre est implémenté, ses tests ciblés et gates finaux nécessaires sont verts, son diff est propre, son rapport est à jour, son commit dédié existe et aucune donnée protégée n'a été touchée.

Merge et push constituent une mission d'intégration distincte, sauf autorisation explicite contraire.

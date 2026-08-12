# Contribuer à Mentor PEBC

1. Travailler sur une branche dédiée, jamais directement sur `main`.
2. Préserver les changements non liés déjà présents.
3. Installer avec `pnpm.cmd install --frozen-lockfile`.
4. Effectuer un changement cohérent et limité, avec tests déterministes.
5. Exécuter `pnpm.cmd run verify` avant revue.

Les dépendances vont vers l’intérieur : présentation → application → domaine. L’infrastructure implémente les ports. Le domaine ne dépend ni de Next.js, ni de SQLite, ni du système de fichiers. Une route HTTP ne doit pas introduire de nouvelle requête SQL directe.

Aucun secret ne doit entrer dans Git, le navigateur, les logs ou les fixtures. Ne journalisez jamais un document complet. Les documents importés sont des données non fiables. Ne modifiez ni `data/` ni `storage/` pendant les tests.

Les commandes doivent fonctionner dans PowerShell. Utilisez `pnpm.cmd` si `pnpm.ps1` est bloqué et les APIs `path` pour les chemins contenant des espaces.

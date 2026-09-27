# Test OpenAI isolé — préparation uniquement

Modèle demandé : `gpt-5.6-terra`. La clé reste exclusivement dans Render Environment / `OPENAI_API_KEY`, service mentor-platform. Aucune récupération, copie, lecture de valeur ou modification de configuration Render n'a été effectuée. Modèle compatible Responses/Structured Outputs : https://developers.openai.com/api/docs/models/gpt-5.6-terra

## Exécution future, après autorisation humaine distincte

Utiliser un checkout isolé contenant cet utilitaire et ses dépendances, dans un processus serveur disposant **déjà** de la clé. Ne pas démarrer Next.js, ne pas installer/déployer un runtime et ne pas exécuter un script de migration. Le PDF exact doit être présent en lecture seule dans ce serveur ; son emplacement effectif reste à confirmer. Le script refuse un checksum différent de `f6e0e6a5c46a9504719974cf979c18924b612f79bc96697d069e88774aa34bd7`.

Contrôle préalable sans appel réseau et sans besoin de clé :

```sh
node scripts/run-tsx.mjs scripts/test-openai-course-isolated.ts \
  --pdf="/chemin-confirme/PROCESSUS-DE-SOINS-PHARMACEUTIQUES_Cours-Maitre-PEBC.pdf"
```

Commande réelle **non exécutée**, réservée à une future autorisation :

```sh
OPENAI_MCQ_MODEL=gpt-5.6-terra \
node scripts/run-tsx.mjs scripts/test-openai-course-isolated.ts \
  --pdf="/chemin-confirme/PROCESSUS-DE-SOINS-PHARMACEUTIQUES_Cours-Maitre-PEBC.pdf" \
  --authorize-openai-test
```

Cette affectation du modèle concerne uniquement le processus ; elle ne change pas les variables du service Render. `OPENAI_API_KEY` est héritée sans être passée en argument ni imprimée. Le garde existant `AI_DAILY_BUDGET_CAD` doit déjà être positif, sinon arrêt. Aucun secret ne doit être saisi dans la commande, le dépôt ou la conversation. Ne pas utiliser `set -x`, afficher l'environnement ou activer des traces HTTP contenant les en-têtes.

## Isolation et limites

- Lecture du PDF, vérification SHA-256, extraction locale, un seul appel Responses, deux candidats DRAFT. Pas de retry automatique.
- Réutilisation du connecteur serveur, `store:false`, validation stricte JSON, nombre, quatre choix, réponse unique, rubriques et citation présente dans le texte exact. La validation sémantique clinique reste humaine.
- Aucune connexion SQLite ni import de module DB, bootstrap applicatif, importer de corpus ou publication. Aucun paramètre DB accepté.
- Provenance du test : UUID éphémère en mémoire et PDF exact vérifié. Ce n'est **pas** un source_version_id de production. Aucune équivalence avec une source production n'est inventée.
- Aucun contenu candidat ni secret imprimé. Seul un résumé de contrôles est affiché ; les erreurs n'affichent pas les réponses fournisseur ni les exceptions brutes.
- Aucun fichier de résultat : candidats et texte restent dans la mémoire du processus, libérée à sa fin. Rien à nettoyer dans Mentor, aucune donnée métier permanente, SNC/SNA inchangés.
- Deux candidats seulement, plafond de sortie du connecteur 24 000 tokens, timeout 120 s, sans retry. L'appel peut être facturé même en cas d'échec. Le garde monétaire existant n'est pas une mesure de facturation ; aucun plafond financier effectif n'est prétendu.
- `store:false` n'est pas une promesse de rétention nulle du fournisseur. Le test transmet le texte du PDF à l'API OpenAI après autorisation.

## Résultats locaux

Contrôle sans autorisation réseau du PDF réel : PASS, checksum conforme, 20 pages, `PREPARED_ONLY`, `realCallExecuted:false`, `filesWritten:0`, `databaseOpened:false`.

Preview http://127.0.0.1:4320/library : provider/identité synthétiques, SQLite en mémoire. Vérification HTTP complète : 10 DRAFT, une modification, un rejet, neuf validations/publications de test, session de cinq questions, score 80 %, historique/corrections/erreurs présents, accès du second learner refusé. Aucun appel réel ni accès production. Le dialogue natif du navigateur reste à confirmer humainement ; les API ont été vérifiées directement contre le seul harnais local.

Test réel OpenAI : NON EXÉCUTÉ. Avant celui-ci : autorisation explicite, checkout serveur isolé disponible, chemin du PDF confirmé et configuration serveur compatible. Ne pas lire ni exporter la clé pour vérifier ces préconditions.

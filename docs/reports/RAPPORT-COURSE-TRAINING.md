# Entraînement personnel depuis un cours

Branche : `codex/course-training`. Aucun déploiement ni accès à la DB production.

## Parcours et stockage

Bibliothèque USER_UPLOAD READY/COMPLETED → cours autorisé → préparation OpenAI → DRAFT → revue par le propriétaire → validation explicite → publication versionnée → session STANDARD filtrée sur la version documentaire actuelle.

Les tables v20 existantes suffisent. Aucune migration. `mcq_item_editorial_metadata.corpus_id` et les identités créées par le serveur portent le préfixe réservé `PERSONAL-COURSE:`. Le catalogue exclut ces ressources sans ownership documentaire correspondant. Les corpus historiques globaux restent globaux ; ni SNC ni SNA ne sont réécrits. Ce préfixe est fixé par le serveur, jamais choisi par le navigateur ou le modèle.

Les versions sont immuables, y compris les brouillons : Modifier ajoute DRAFT, Valider ajoute IN_REVIEW (approbation explicite du propriétaire dans ce parcours), Rejeter ajoute RETIRED, Publier ajoute PUBLISHED. Chaque commande vérifie la version attendue ; une requête périmée est refusée. La publication exige des questions validées et une confirmation finale. La revue est conservée après rechargement. Un lot en revue doit être terminé avant d'en générer un autre.

Le serveur dérive l'identité avec `requirePilotIdentity`, puis vérifie document → ownership → source → version exacte. Accès absent ou tiers : 403 générique. Aucune identité du PDF de référence n'est codée en dur. Le contrôle est rejoué après l'appel IA et avant l'enregistrement.

## Génération

Connecteur serveur OpenAI Responses API avec sortie structurée stricte, `store: false`, aucun outil externe, aucun retry automatique. Configuration réutilisée : `OPENAI_API_KEY`, `AI_DAILY_BUDGET_CAD`. Configurer également `OPENAI_MCQ_MODEL` dans l'environnement serveur avec un modèle compatible Structured Outputs. Aucune clé dans l'UI, les réponses ou les logs. Configuration absente : 503 contrôlé ; aucun faux moteur de secours.

Documentation API consultée : https://developers.openai.com/api/docs/guides/structured-outputs

Limites : 1 à 10 questions, 180 000 caractères source, 24 000 tokens de sortie maximum, délai serveur 120 secondes. Les quotas AI_REQUEST existants sont réutilisés. Le paramètre monétaire existant doit être positif pour activer le connecteur ; il ne constitue pas un calcul de coût réel ni une garantie de plafond quotidien en dollars. Le quota existant limite les requêtes.

Le document est traité comme donnée, jamais comme instruction. Une citation doit être présente dans le texte extrait ; les questions/options dupliquées sont refusées. Les rubriques Mentor V2 sont structurées ; les éléments non étayés doivent indiquer NOT_SUPPORTED_BY_SOURCE. Cela ne prouve pas automatiquement l'exactitude clinique : la revue humaine reste obligatoire. Le texte envoyé à OpenAI est annoncé avant préparation.

Compétences : codes du blueprint PEBC 03-2026 déjà présent dans le dépôt. Thèmes/objectifs propres au cours, explicitement locaux, sans prétendre créer des Learning Objectives officiels. La compétence proposée est visible dans la revue ; une question mal mappée doit être rejetée. Aucune nouvelle donnée MLE.

## Tests et preview

Tests synthétiques uniquement : ownership, refus source indisponible, provenance, DRAFT, édition/rejet/validation, publication, versions inchangées, filtrage privé, corpus globaux, session STANDARD, réponses, score, historique, erreurs, reprise et intégrité SQLite. API : identité avant chargement métier, ownership avant comptabilisation, refus identité client et publication non confirmée. UI : bouton conditionnel, édition, approbation et confirmation finale.

Le test réel du PDF Processus de soins et de la génération OpenAI reste conditionné à la disponibilité du fichier local, de la clé serveur et du modèle. Aucun résultat simulé ne doit être présenté comme une génération clinique réelle.

Résultats observés le 25 septembre 2026 : tests ciblés 108 PASS (107 dans le lot initial, puis ajout d'un cas et fichier d'intégration 8/8 PASS), typecheck PASS, lint PASS avec deux avertissements préexistants hors périmètre, build PASS, diff check PASS. Suite globale exécutée une seule fois : 159 fichiers PASS, 823 tests PASS, 1 ignoré, 0 échec, durée 290,08 secondes.

Preview local : http://127.0.0.1:4320/library. Harnais temporaire hors dépôt, SQLite en mémoire, identité et générateur simulés explicitement dans un bandeau. Vérification navigateur : document prêt, accès au cours, 10 brouillons, correction/provenance, approbation individuelle et confirmation finale de publication visibles. Le dialogue natif de confirmation n'a pas pu être traité par l'automatisation ; la suite visuelle publication/session n'est donc pas déclarée validée. Le parcours publication/session/résultat/persistance et le refus d'un autre learner passent dans les tests d'intégration isolés.

PDF réel retrouvé localement : `PROCESSUS-DE-SOINS-PHARMACEUTIQUES_Cours-Maitre-PEBC.pdf`, SHA-256 `f6e0e6a5c46a9504719974cf979c18924b612f79bc96697d069e88774aa34bd7`. Aucun appel OpenAI réel effectué. Clarification humaine : clé uniquement dans Render Environment / OPENAI_API_KEY, modèle demandé `gpt-5.6-terra`. Ne pas récupérer la clé en local. Le test serveur préparé, ses commandes et ses limites sont décrits dans `OPENAI-COURSE-ISOLATED-TEST.md`. Les quatre tests réels Processus (génération/revue/publication/session) restent NOT_RUN. La validation clinique du contenu généré et la validation Auth0 live ne sont pas acquises par le harnais synthétique.

Complément : parcours HTTP du Preview synthétique entièrement vérifié (édition/rejet/validation/publication, session, score, historique, erreurs, refus tiers). Tests de préparation isolée ajoutés : premier lot 15/15 PASS ; après correction du type binaire PDF dans l'utilitaire uniquement, 13 PASS et un timeout de démarrage du worker UI (échec d'infrastructure avant exécution de ce fichier). Aucun timeout augmenté et aucune suite globale relancée. Les résultats build/global ci-dessus concernent le runtime applicatif inchangé.

Aucun push, aucune migration, aucune écriture production. SNC/SNA, Settings/Auth0, import documentaire, tables et migrations inchangés. Le Preview synthétique peut être examiné ; le parcours réel autonome n'est pas encore validé et aucun déploiement n'est proposé.

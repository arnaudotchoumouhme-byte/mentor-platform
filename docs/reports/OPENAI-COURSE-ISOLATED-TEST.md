# Test OpenAI ponctuel — préparation GitHub Actions

## Test autorisé sur extrait : pages 1 à 8

Cette décision remplace le périmètre « PDF complet » ci-dessous pour le test futur. Le PDF original et son checksum restent inchangés. Seules les pages 1–8 sont extraites en mémoire ; les pages 9–20 ne sont pas lues pour la génération. Aucun nouveau PDF ni fichier résultat n'est créé. Le nom de source transmis porte explicitement « extrait pages 1–8 uniquement » ; la validation des citations porte sur ce seul texte.

Mesure locale sans clé ni réseau : **19 992 octets** pour le payload complet, plus réserve de **8 192**, soit **28 184 tokens estimés** (pas un comptage exact). `28 184 < 30 000` : PASS. L'égalité à 30 000 est également refusée. Le plafond de sortie reste 6 000 tokens, le budget 1 CAD, le plafond de coût 0,65 CAD. Aucun second appel, retry ou comptage OpenAI.

Le contrôle GitHub utilise la même extraction et mesure avant l'étape recevant le secret. Aucun dispatch, push ou merge n'est effectué. Blocages avant lancement : workflow non enregistré sur la branche par défaut, secret non confirmé et quota CI non vérifié. La politique tarifaire expire toujours le 29 septembre 2026 à 00:00 UTC ; toute utilisation ultérieure exige une nouvelle vérification documentaire. Aucun résultat de génération ou contrôle clinique n'est revendiqué avant l'appel et la revue humaine.

## État et périmètre

Workflow créé localement : `.github/workflows/openai-course-isolated.yml`.
Aucun appel réel, dispatch, push, merge, service Render ou déploiement effectué pour cette préparation. Aucun accès à une DB ni modification du moteur métier. La clé n'a été ni lue ni récupérée.

Le workflow utilise seulement `workflow_dispatch`, un runner GitHub `ubuntu-24.04`, les permissions `contents: read`, le SHA exact du dispatch et la branche `codex/openai-course-isolated-test`. Il refuse un autre SHA, une autre branche ou une relance du même run. Une installation sans lifecycle hooks précède le preflight. Aucune donnée ni variable production n'est importée. Aucun artefact métier n'est enregistré.

## Limite locale explicite et historique du refus du PDF complet

Vérification documentaire : 27 septembre 2026 ; politique expirant le 29 septembre 2026 à 00:00 UTC. Toute exécution après cette date est refusée. Le JSON de barème fourni par environnement n'est plus accepté : un simple `boundsVerified=true` ne constitue pas une preuve et ne permet plus de diminuer artificiellement le calcul.

- Modèle exact : `gpt-5.6-terra`.
- Requête complète : au plus **21 808 octets UTF-8** ; texte uniquement, aucune conversation antérieure ni outil. Toutes les instructions, le document, les échappements JSON et le schéma sont inclus dans cette mesure.
- Entrée : **MAX_TEST_INPUT_TOKENS = 30 000**. Aucun tokenizer OpenAI/compatible n'est installé dans le projet. La méthode locale conservatrice compte un token par octet UTF-8 du payload sérialisé complet, plus **8 192 tokens** de réserve de formatage. Le BPE sur octets fusionne des séquences d'octets ; la partie textuelle ne peut donc pas produire davantage de tokens ordinaires que d'octets. La réserve de formatage est une marge d'ingénierie conservatrice, pas un comptage exact ni une limite contractuelle publiée par OpenAI. Le plafond de contexte du modèle n'est plus utilisé.
- Sortie : **6 000 tokens**, imposés par `max_output_tokens`, raisonnement compris.
- Tarif publié : 2 USD/M entrée, 12 USD/M sortie. Le calcul prend aussi les majorations contexte long (x2 entrée, x1,5 sortie) et écriture cache (x1,25 entrée), soit **5 USD/M entrée et 18 USD/M sortie**. Aucun rabais cache supposé ; niveau de service `default`.
- Conversion conservatrice : **2 CAD/USD**, contre 1,4145 publié pour le 25 septembre 2026, soit environ 41,4 % de réserve de change.
- Marge supplémentaire : **25 %**, puis arrondi supérieur au centime. Ce n'est pas une garantie contractuelle du taux bancaire ou des frais du compte.
- Calcul du plafond autorisé : `(30 000 × 5 + 6 000 × 18) / 1 000 000 × 2 × 1,25 = 0,645`, arrondi à **0,65 CAD**, strictement inférieur à 1 CAD. Les majorations contexte long sont conservées par prudence malgré le plafond d'entrée réduit.

**Mesure du PDF complet : 20 pages, 48 818 caractères, 51 523 octets UTF-8 de texte ; payload complet normalisé = 55 917 octets ; estimation haute locale = 64 109 tokens.** Ce chiffre n'est pas un comptage exact par tokenizer. Aucun caractère du cours n'est tronqué. Le payload est construit par le connecteur existant avec un transport en mémoire sans réseau ni clé réelle, puis mesuré. Le test retourne `BLOCKED_INPUT_LIMIT` et un code de sortie non nul. Le workflow effectue cette mesure avant l'étape recevant le secret ; le transport réel répète le contrôle immédiatement avant réseau.

**64 109 > 30 000 : STOP pour ce PDF.** Le garde financier passe pour les entrées admissibles, mais ce document n'est pas admissible avec cette estimation locale. Aucun appel n'est exécuté ; aucun second appel de comptage n'est ajouté.

Sources officielles :
- [Modèle, contexte et tarifs](https://developers.openai.com/api/docs/models/gpt-5.6-terra).
- [Comptage OpenAI](https://developers.openai.com/api/docs/guides/token-counting) : les tokens de formatage et de schéma ne sont pas tous comptés par une tokenisation locale du texte.
- [Taux indicatifs Banque du Canada](https://www.bankofcanada.ca/rates/exchange/daily-exchange-rates/).
- [BPE sur octets, implémentation pédagogique OpenAI](https://github.com/openai/tiktoken/blob/main/tiktoken/_educational.py).

Le nombre exact de tokens du modèle n'est pas prétendu connu. Aucune nouvelle dépendance de tokenisation n'a été installée et aucune sélection/troncature du PDF n'a été effectuée. Le dépassement reste bloquant ; ne pas relever silencieusement la limite ou diminuer la réserve pour forcer un PASS.

Le transport interdit les redirections et toute seconde tentative, même après erreur réseau. Le schéma impose deux candidats, sans boucle ni retry. La limite budgétaire est par exécution ; sans stockage elle ne constitue pas un compteur quotidien. Ne pas lancer plusieurs dispatchs.

## PDF isolé

Fichier préparé : `scripts/fixtures/openai-isolated/PROCESSUS-DE-SOINS-PHARMACEUTIQUES_Cours-Maitre-PEBC.pdf`.

69 896 octets ; SHA-256 : `f6e0e6a5c46a9504719974cf979c18924b612f79bc96697d069e88774aa34bd7`.

Copie depuis le PDF local fourni, sans accès production. Nom et checksum vérifiés. Le workflow vérifie les octets avant toute génération. Le script vérifie de nouveau le nom/checksum et extrait en mémoire. Ce PDF sera disponible au runner seulement après publication autorisée des fichiers de test sur GitHub.

## Secret et activation future

L'utilisateur peut configurer manuellement `OPENAI_API_KEY` dans Repository → Settings → Secrets and variables → Actions → New repository secret. Ne jamais fournir sa valeur à Codex ni la récupérer depuis Render. Le secret n'est injecté que dans la dernière étape, jamais dans l'installation, les outputs ou un fichier. Les autres variables de cette étape sont `OPENAI_MCQ_MODEL=gpt-5.6-terra` et `AI_DAILY_BUDGET_CAD=1`.

Le workflow doit d'abord être présent sur la branche par défaut pour son premier lancement manuel : [documentation GitHub](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow). Aucun merge vers main n'est effectué ici. Une intégration distincte du seul workflow de contrôle reste donc à décider ; le code testé doit rester celui de la branche de test. Vérifier aussi les minutes Actions disponibles. Aucun abonnement Render supplémentaire.

Même avec le secret configuré, **ne pas déclencher actuellement** : workflow non publié/enregistré, quota CI non vérifié. L'extrait 1–8 autorisé ci-dessus remplace désormais le PDF complet et respecte la limite d'entrée.

## Validation et limites des résultats

Tests locaux : 24 PASS ; garde financier, budget invalide, barème inconnu/expiré, absence de réseau au-dessus du budget ou de la taille, frontière 30 000/30 001, UTF-8 multioctet, refus du document entier sans troncature, modèle, deux candidats, seconde tentative interdite, dispatch/SHA/branche, isolation du secret et checksum PDF. Aucun test global nécessaire pour ce périmètre isolé.

Un futur résultat de génération ne pourra établir que la conformité structurelle, quatre choix, réponse unique, rubriques Mentor V2 et citation retrouvée dans le PDF. L'exactitude clinique et l'absence d'affirmations non étayées exigent une revue humaine ; ne pas les déclarer validées automatiquement. Candidats uniquement DRAFT en mémoire, pas de fichier résultat, import ou publication. `store:false` ne promet pas une rétention fournisseur nulle.

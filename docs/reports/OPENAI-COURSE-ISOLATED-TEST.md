# Test OpenAI ponctuel — préparation GitHub Actions

## État et périmètre

Workflow créé localement : `.github/workflows/openai-course-isolated.yml`.
Aucun appel réel, dispatch, push, merge, service Render ou déploiement effectué pour cette préparation. Aucun accès à une DB ni modification du moteur métier. La clé n'a été ni lue ni récupérée.

Le workflow utilise seulement `workflow_dispatch`, un runner GitHub `ubuntu-24.04`, les permissions `contents: read`, le SHA exact du dispatch et la branche `codex/openai-course-isolated-test`. Il refuse un autre SHA, une autre branche ou une relance du même run. Une installation sans lifecycle hooks précède le preflight. Aucune donnée ni variable production n'est importée. Aucun artefact métier n'est enregistré.

## Borne financière démontrable et blocage

Vérification documentaire : 27 septembre 2026 ; politique expirant le 29 septembre 2026 à 00:00 UTC. Toute exécution après cette date est refusée. Le JSON de barème fourni par environnement n'est plus accepté : un simple `boundsVerified=true` ne constitue pas une preuve et ne permet plus de diminuer artificiellement le calcul.

- Modèle exact : `gpt-5.6-terra`.
- Requête complète : au plus 180 000 octets UTF-8 ; texte uniquement, aucune conversation antérieure ni outil.
- Entrée : borne publiée du contexte entier, **1 050 000 tokens**. C'est une borne supérieure de sécurité, PAS le nombre probable de tokens du PDF. Aucune borne locale plus serrée couvrant l'encadrement Responses et le schéma n'est justifiée.
- Sortie : **6 000 tokens**, imposés par `max_output_tokens`, raisonnement compris.
- Tarif publié : 2 USD/M entrée, 12 USD/M sortie. Le calcul prend aussi les majorations contexte long (x2 entrée, x1,5 sortie) et écriture cache (x1,25 entrée), soit **5 USD/M entrée et 18 USD/M sortie**. Aucun rabais cache supposé ; niveau de service `default`.
- Conversion conservatrice : **2 CAD/USD**, contre 1,4145 publié pour le 25 septembre 2026, soit environ 41,4 % de réserve de change.
- Marge supplémentaire : **25 %**, puis arrondi supérieur au centime. Ce n'est pas une garantie contractuelle du taux bancaire ou des frais du compte.
- Calcul : `(1 050 000 × 5 + 6 000 × 18) / 1 000 000 × 2 × 1,25 = 13,395`, arrondi à **13,40 CAD**.

**13,40 > 1 : FAIL CLOSED.** Le preflight échoue avant l'étape qui reçoit le secret. Le script réel applique aussi le contrôle avant construction du provider et son transport le répète juste avant réseau. Aucun appel n'est actuellement admissible.

Sources officielles :
- [Modèle, contexte et tarifs](https://developers.openai.com/api/docs/models/gpt-5.6-terra).
- [Comptage OpenAI](https://developers.openai.com/api/docs/guides/token-counting) : les tokens de formatage et de schéma ne sont pas tous comptés par une tokenisation locale du texte.
- [Taux indicatifs Banque du Canada](https://www.bankofcanada.ca/rates/exchange/daily-exchange-rates/).

Le comptage officiel préalable des tokens serait un appel API supplémentaire. Il n'est PAS exécuté ni ajouté ici car la mission limite le total à un appel OpenAI. Ne pas inventer une borne plus faible ou relever le budget pour débloquer artificiellement le test. Une décision ultérieure sera nécessaire pour concilier le comptage préalable et la limite d'appels, ou établir autrement une borne sûre sous 1 CAD.

Le transport interdit les redirections et toute seconde tentative, même après erreur réseau. Le schéma impose deux candidats, sans boucle ni retry. La limite budgétaire est par exécution ; sans stockage elle ne constitue pas un compteur quotidien. Ne pas lancer plusieurs dispatchs.

## PDF isolé

Fichier préparé : `scripts/fixtures/openai-isolated/PROCESSUS-DE-SOINS-PHARMACEUTIQUES_Cours-Maitre-PEBC.pdf`.

69 896 octets ; SHA-256 : `f6e0e6a5c46a9504719974cf979c18924b612f79bc96697d069e88774aa34bd7`.

Copie depuis le PDF local fourni, sans accès production. Nom et checksum vérifiés. Le workflow vérifie les octets avant toute génération. Le script vérifie de nouveau le nom/checksum et extrait en mémoire. Ce PDF sera disponible au runner seulement après publication autorisée des fichiers de test sur GitHub.

## Secret et activation future

L'utilisateur peut configurer manuellement `OPENAI_API_KEY` dans Repository → Settings → Secrets and variables → Actions → New repository secret. Ne jamais fournir sa valeur à Codex ni la récupérer depuis Render. Le secret n'est injecté que dans la dernière étape, jamais dans l'installation, les outputs ou un fichier. Les autres variables de cette étape sont `OPENAI_MCQ_MODEL=gpt-5.6-terra` et `AI_DAILY_BUDGET_CAD=1`.

Le workflow doit d'abord être présent sur la branche par défaut pour son premier lancement manuel : [documentation GitHub](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow). Aucun merge vers main n'est effectué ici. Une intégration distincte du seul workflow de contrôle reste donc à décider ; le code testé doit rester celui de la branche de test. Vérifier aussi les minutes Actions disponibles. Aucun abonnement Render supplémentaire.

Même avec le secret configuré, **ne pas déclencher actuellement** : borne financière au-dessus du plafond, workflow non publié/enregistré, quota CI non vérifié.

## Validation et limites des résultats

Tests locaux : garde financier, budget invalide, barème inconnu/expiré, absence de réseau au-dessus du budget, tailles, modèle, deux candidats, seconde tentative interdite, dispatch/SHA/branche, isolation du secret et checksum PDF. Typecheck, lint et diff check requis. Aucun test global nécessaire pour ce périmètre isolé.

Un futur résultat de génération ne pourra établir que la conformité structurelle, quatre choix, réponse unique, rubriques Mentor V2 et citation retrouvée dans le PDF. L'exactitude clinique et l'absence d'affirmations non étayées exigent une revue humaine ; ne pas les déclarer validées automatiquement. Candidats uniquement DRAFT en mémoire, pas de fichier résultat, import ou publication. `store:false` ne promet pas une rétention fournisseur nulle.

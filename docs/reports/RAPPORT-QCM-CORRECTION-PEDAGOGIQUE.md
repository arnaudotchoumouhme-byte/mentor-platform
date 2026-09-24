# Correction pédagogique QCM Partie I — audit et préparation

## Modèle et périmètre

`mcq_question_versions.explanation` est un texte obligatoire (contrat corpus : 20 000 caractères maximum). Aucun champ distinct rationale, distractor rationale ou clinical pearl. La provenance existe dans `provenance`; les références documentaires complètes restent dans `mcq_item_editorial_metadata` (type, locator, label). Le runner recevait explanation après réponse, même correcte, mais affichait un paragraphe sans bonne option explicite pendant la séance. Le défaut de richesse provient aussi du corpus.

Le composant partagé affiche verdict, bonne option, réponse choisie si incorrecte et toute l’explication, aussi dans la correction de séance. La provenance existante est désormais transmise uniquement avec une correction autorisée. Aucun accès DB supplémentaire, aucune modification de score, réponse persistée ou isolation. L’examen blanc continue de masquer les corrections avant sa fin.

Le champ explanation peut contenir des titres sur une ligne (texte simple ou Markdown `##`) : Pourquoi cette réponse est correcte ; Mécanisme / concept à comprendre ; Pourquoi les autres options sont fausses ; Raisonnement du pharmacien ; Point PEBC à retenir ; Piège classique ; Application clinique ; Source. Chaque distracteur peut être détaillé sous sa propre ligne A/B/C/D. Le texte est échappé par React, sans HTML exécuté. Les rubriques absentes ne sont pas inventées. Les anciennes explications restent visibles intégralement. La provenance UUID n’est pas présentée comme une citation lisible : les citations éditoriales existantes restent préservées en stockage, leur exposition détaillée future reste une limite.

## Audit des dix explications publiées

Toutes sont insuffisantes pour le format pédagogique complet demandé, sans que ce jugement invalide leur exactitude clinique. Aucun texte clinique du corpus n’est modifié.

### SNC-001 — INSUFFISANTE

Explication actuelle : la source définit le SNC comme le cerveau et la moelle épinière.

Proposition éditoriale séparée (non publiée) : Distinguer explicitement les structures citées par chaque option et rattacher chacune à la définition de la source. Ajouter un raisonnement fondé sur les indices réellement présents, une règle mémorisable et un piège seulement s’ils sont soutenus par la source. Les justifications individuelles des distracteurs et les applications cliniques nécessitent validation éditoriale.

### SNC-002 — INSUFFISANTE

Explication actuelle : le GABA est présenté comme inhibiteur; l'augmenter renforce le « frein » neuronal et diminue l'excitabilité excessive.

Proposition éditoriale séparée (non publiée) : Expliquer séparément les distracteurs et relier les indices de la question au mécanisme déjà cité. Ajouter un raisonnement fondé sur les indices réellement présents, une règle mémorisable et un piège seulement s’ils sont soutenus par la source. Les justifications individuelles des distracteurs et les applications cliniques nécessitent validation éditoriale.

### SNC-003 — INSUFFISANTE

Explication actuelle : la source associe le passage plus facile à une petite taille, à la lipophilie et à une forme non ionisée.

Proposition éditoriale séparée (non publiée) : Décomposer les trois propriétés citées et comparer chaque distracteur à ces critères. Ajouter un raisonnement fondé sur les indices réellement présents, une règle mémorisable et un piège seulement s’ils sont soutenus par la source. Les justifications individuelles des distracteurs et les applications cliniques nécessitent validation éditoriale.

### SNC-004 — INSUFFISANTE

Explication actuelle : Santé Canada recommande d'appeler immédiatement le 911 en cas de surdose soupçonnée, d'administrer la naloxone si elle est disponible, de rester auprès de la personne et de suivre les consignes d'urgence. La naloxone ne remplace jamais l'appel au 911.

Proposition éditoriale séparée (non publiée) : Détailler chaque distracteur à partir de la référence canadienne déjà citée ; conserver la priorité de la conduite urgente validée. Ajouter un raisonnement fondé sur les indices réellement présents, une règle mémorisable et un piège seulement s’ils sont soutenus par la source. Les justifications individuelles des distracteurs et les applications cliniques nécessitent validation éditoriale.

### SNC-005 — INSUFFISANTE

Explication actuelle : la source relie directement le blocage D2 dans les voies motrices à la rigidité, aux tremblements, à l'akathisie et à la dystonie.

Proposition éditoriale séparée (non publiée) : Relier chaque option au mécanisme décrit ; faire valider toute extension concernant surveillance ou conseil. Ajouter un raisonnement fondé sur les indices réellement présents, une règle mémorisable et un piège seulement s’ils sont soutenus par la source. Les justifications individuelles des distracteurs et les applications cliniques nécessitent validation éditoriale.

### SNC-006 — INSUFFISANTE

Explication actuelle : l'inhibition de la recapture de la sérotonine est un mécanisme établi de la sertraline, tandis que l'amélioration clinique peut nécessiter plusieurs semaines. Le délai thérapeutique ne doit pas être attribué avec certitude à un mécanisme unique d'adaptation des récepteurs ou des circuits.

Proposition éditoriale séparée (non publiée) : Distinguer mécanisme établi et délai clinique ; préserver expressément la réserve sur les explications mécanistiques du délai. Ajouter un raisonnement fondé sur les indices réellement présents, une règle mémorisable et un piège seulement s’ils sont soutenus par la source. Les justifications individuelles des distracteurs et les applications cliniques nécessitent validation éditoriale.

### SNC-007 — INSUFFISANTE

Explication actuelle : les monographies canadiennes confirment qu'un surdosage d'amitriptyline peut entraîner des complications cardiaques, neurologiques et hémodynamiques graves, notamment troubles du rythme ou de la conduction, hypotension, convulsions et coma.

Proposition éditoriale séparée (non publiée) : Détailler la justification de chaque option à partir des monographies référencées ; ne pas ajouter de conduite clinique non validée. Ajouter un raisonnement fondé sur les indices réellement présents, une règle mémorisable et un piège seulement s’ils sont soutenus par la source. Les justifications individuelles des distracteurs et les applications cliniques nécessitent validation éditoriale.

### SNC-008 — INSUFFISANTE

Explication actuelle : l'inhibition périphérique protège la lévodopa avant son passage dans le SNC, augmente la quantité disponible pour le cerveau et réduit certains effets périphériques.

Proposition éditoriale séparée (non publiée) : Décomposer le raisonnement périphérie/SNC et expliquer les erreurs de localisation proposées par les distracteurs. Ajouter un raisonnement fondé sur les indices réellement présents, une règle mémorisable et un piège seulement s’ils sont soutenus par la source. Les justifications individuelles des distracteurs et les applications cliniques nécessitent validation éditoriale.

### SNC-009 — INSUFFISANTE

Explication actuelle : la source recommande une prise régulière, déconseille l'arrêt brutal et rappelle que l'absence de crise ne signifie pas guérison.

Proposition éditoriale séparée (non publiée) : Expliciter les indices menant au conseil déjà validé ; traiter chaque distracteur sans proposer de schéma d’arrêt ou de dose. Ajouter un raisonnement fondé sur les indices réellement présents, une règle mémorisable et un piège seulement s’ils sont soutenus par la source. Les justifications individuelles des distracteurs et les applications cliniques nécessitent validation éditoriale.

### SNC-010 — INSUFFISANTE

Explication actuelle : la source relie le donépézil à l'inhibition de l'acétylcholinestérase, décrit des effets digestifs avec cette classe et distingue la mémantine comme antagoniste NMDA.

Proposition éditoriale séparée (non publiée) : Comparer les mécanismes déjà cités et justifier chaque distracteur ; valider séparément les conseils de surveillance. Ajouter un raisonnement fondé sur les indices réellement présents, une règle mémorisable et un piège seulement s’ils sont soutenus par la source. Les justifications individuelles des distracteurs et les applications cliniques nécessitent validation éditoriale.

## Conditions avant enrichissement

Ces propositions sont un plan de rédaction, pas dix corrections médicales approuvées. Vérifier les passages sources et les références existantes, rédiger et faire valider les enrichissements séparément. Les V1/V2 publiées sont immuables : une future publication devra créer une nouvelle version, jamais réécrire les vingt versions en production. Aucun import, appel IA, accès à la DB réelle, migration, push ou déploiement dans cette mission.

## Validation

Tests ciblés : 28/28 PASS (runner, session jouable, flux examen blanc). Typecheck : PASS. Lint : PASS. Build production : PASS. Diff check : PASS. Suite globale exécutée une seule fois avec maxWorkers=1 : 758 PASS, 1 SKIPPED, 0 FAIL, 151 fichiers, 350,71 s. Le premier lanceur pnpm était bloqué avant compilation par un accès réseau restreint pour vérifier la signature ; le build a ensuite réussi avec cet accès autorisé, sans contournement de signature. Revue React ciblée : composant partagé sans nouvel effet, appel réseau ou dépendance ; texte échappé, focus du runner et frontière de correction conservés. La prévisualisation du code ne signifie pas que les dix corrections détaillées sont déjà rédigées ou disponibles en production.

SAFE_FOR_PREVIEW = OUI pour le code. Aucun déploiement ni import de corpus effectué. Les dix enrichissements médicaux restent à rédiger et valider avant publication ; aucune correction complète SNC ne doit être annoncée comme déjà disponible.

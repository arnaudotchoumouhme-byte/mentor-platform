# Runbook maître des actions humaines différées

## 1. Objet

Ce document prépare les décisions et opérations humaines restantes pour Mentor Platform. Il ne constitue aucune autorisation. Lors de son utilisation future, appliquer strictement le cycle : **une action → une vérification → une capture expurgée → une validation → l’action suivante**.

## 2. État courant vérifié le 2026-09-03

- Dépôt : `arnaudotchoumouhme-byte/mentor-platform`.
- P1 : branche distante `codex/p1-autonomous`, HEAD attendu `a33877487e332bf8c2cbc326323487fead2f72f9`, revue automatisée approuvée, poussée, non fusionnée, non déployée.
- Post-P1 : branche locale `codex/post-p1-autonomous`, HEAD avant clôture technique `eeec9b11bd0c145020e942d9ce4e85674b03f939`, non poussée, non fusionnée, non déployée. Le HEAD final doit être relevé au début de H6A.
- Post-P1 : campagne globale finale 629/629. Le scénario `server-database-startup.test.ts` effectue un bootstrap v16 puis un preflight complet ; sa contention sous charge a été fermée par un timeout local mesuré de 15 s, sans changement SQLite production.
- SNC : l’ingestion officielle Render reste à effectuer. Une tentative V1 antérieure a échoué proprement avec `MCQ_SOURCE_VERSION_NOT_FOUND`, sans écriture partielle.
- Production : compte pilote fonctionnel. Aucun accès production n’a été effectué pour créer ce runbook.

## 3. Règles de sécurité absolues

- Une revue n’autorise jamais un merge ; une décision produit n’autorise jamais une écriture.
- Une autorisation doit nommer précisément branche, HEAD, cible et opération.
- Ne jamais utiliser `git push --force`, `git push --force-with-lease`, rebase ou SQL manuel.
- Avant chaque mutation Render/SQLite : état connu, sauvegarde fraîche vérifiée, autorisation séparée, post-validation.
- Ne jamais partager mot de passe, cookie, jeton de session, secret Auth0, clé privée, clé API, en-tête `Authorization` ou identifiants DB.
- Masquer toute donnée sensible dans les captures. Ne transmettre que les identifiants techniques explicitement demandés.
- Si un HEAD, checksum, schéma, branche ou plan change, arrêter et refaire la revue correspondante.
- Ne jamais considérer « continue », « ok » ou « vas-y » comme autorisation d’une mutation de production.

## 4. Registre des actions humaines

| ID | Action | Type / plateforme | Risque | État | Dépend de | Bloque | Réversible | Backup | Autorisation explicite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| H1 | Revue distante P1 | REVIEW / GitHub | Moyen | READY | — | H2 | Oui | Non | Non |
| H2 | Autoriser le merge P1 | DECISION / GitHub | Moyen | WAITING_H1 | H1 | H2B | Oui avant exécution | Non | Oui |
| H2B | Exécuter le merge P1 | GIT / GitHub | Moyen | WAITING_H2 | H2 | D1 | Revert nécessaire | Non | Oui |
| H3 | Ingestion officielle SNC | CONTENT_INGESTION / Mentor production | Élevé | READY_BUT_DEFERRED | session pilote active | H3B | Workflow dédié requis | Recommandé | Oui |
| H3B | Revue de la projection SNC | REVIEW / dépôt | Moyen | WAITING_H3 | H3 | H3C | Oui | Non | Non |
| H3C | Publier les artefacts SNC | GIT / GitHub | Moyen | WAITING_H3B | H3B | H3D | Revert possible | Non | Oui |
| H3D | Créer le backup pré-import | DATABASE / Render | Élevé | WAITING_H3C | H3C | H3E | Oui | Objet de l’action | Oui |
| H3E | Import réel SNC V1 | DATABASE / Render | Élevé | WAITING_H3D | H3D | H3F | Restore contrôlé | Oui vérifié | Oui |
| H3F | Import réel SNC V2 | DATABASE / Render | Élevé | WAITING_H3E | V1 validée | pilote QCM | Restore contrôlé | Oui vérifié | Oui |
| H4 | Choisir la reprise MCQ P1-05 | DECISION / produit | Moyen | READY | — | futur développement | Oui avant code | Non | Oui |
| H5 | Choisir la convergence Mock/MCQ | DECISION / architecture | Élevé | READY | — | futur développement | Oui avant code | Non | Oui |
| H6A | Revue finale post-P1 | REVIEW / local puis GitHub | Moyen | READY | clôture technique validée | H6B | Oui | Non | Non |
| H6B | Autoriser le push post-P1 | DECISION / GitHub | Faible à moyen | WAITING_H6A | H6A | H6C | Oui avant push | Non | Oui |
| H6C | Pousser la branche post-P1 | GIT / GitHub | Moyen | WAITING_H6B | H6B | H6D | Branche supprimable séparément | Non | Oui |
| H6D | Revue PR post-P1 | REVIEW / GitHub | Moyen | WAITING_H6C | H6C | futur merge | Oui | Non | Non |
| D1 | Autoriser un déploiement | DECISION / Render | Élevé | WAITING_MERGE | branche cible validée | D2 | Oui avant exécution | Selon DB | Oui |
| D2 | Exécuter le déploiement | DEPLOY / Render | Élevé | WAITING_D1 | D1 | D3 | Rollback Render | Selon mutation | Oui |
| D3 | Vérifier le déploiement | REVIEW / Render + Mentor | Élevé | WAITING_D2 | D2 | ouverture pilote | N/A | Non | Non |

## 5. Ordre recommandé et parallélisme

Flux Git P1 : `H1 → H2 → H2B → contrôle de l’auto-deploy → D1/D2/D3 si autorisés`.

Flux post-P1 : `H6A → H6B → H6C → H6D`. Le diagnostic SQLite préalable est clos.

Flux SNC : `H3 → H3B → H3C → H3D → H3E → validation V1 → H3F`.

H4 et H5 sont des décisions indépendantes : elles peuvent être prises en parallèle des flux Git et SNC. H3 ne dépend pas du merge P1, mais toute mutation production reste différée et isolée.

## 6. H1 — Revue humaine distante P1

### Objectif

Vérifier dans GitHub la branche `codex/p1-autonomous` contre `main`, sans mutation.

### Prérequis et risque

- Plateforme : GitHub Web UI.
- Base : `main` ; compare : `codex/p1-autonomous`.
- HEAD attendu : `a33877487e332bf8c2cbc326323487fead2f72f9`.
- Risque : moyen, car une branche ou un HEAD erroné invalide la revue.

### Procédure

1. Ouvrir le dépôt `arnaudotchoumouhme-byte/mentor-platform`.
2. Cliquer **Pull requests**, puis **New pull request** ou **Compare & pull request**.
3. Sélectionner `base: main` et `compare: codex/p1-autonomous`.
4. Ne pas créer la PR si l’objectif est uniquement la revue ; la page Compare suffit.
5. Vérifier que le dernier commit est `a338774`.
6. Vérifier les commits attendus : `d4a6d20`, `305546b`, `d0b6161`, `1adc614`, `888fc28`, `8f3a981`, `d98f2a7`, `60a735b`, `7d76d80`, `c557100`, `a338774`.
7. Ouvrir **Files changed** et confirmer uniquement les corrections P1 attendues : Search, Library, Settings, robustesse asynchrone et récupération MCQ.
8. Vérifier les checks disponibles et le statut de conflit.
9. Confirmer : aucun contenu clinique SNC, migration, Auth0, Render, secret, DB production, clé de réponse exposée ou affaiblissement de l’isolation learner.

### Attendu / STOP

`HUMAN_REVIEW_PASS_IF` : branche et HEAD exacts, commits connus, diff attendu, checks verts ou cohérents, aucun conflit ni fichier sensible.

`STOP_IF` : conflit, commit inconnu, migration inconnue, secret, contenu clinique inattendu, DB, mauvaise branche ou HEAD différent.

### Captures et retour

- `H1-1` : sélecteurs base/compare et HEAD, données sensibles masquées.
- `H1-2` : résumé **Files changed**.
- `H1-3` : checks et conflict status.
- Rapporter : `BRANCH`, `HEAD`, `COMMITS`, `FILES_CHANGED`, `CHECKS`, `CONFLICT_STATUS`.

Arrêtez-vous ici et envoyez les captures/résultats avant de poursuivre.

## 7. H2/H2B — Autorisation puis exécution du merge P1

### Objectif

Fusionner P1 seulement après une H1 réussie et inchangée. Stratégie conservatrice recommandée : **merge commit**, cohérente avec l’historique d’intégration du projet ; ni squash ni rebase.

### Prérequis

- H1 = PASS sur HEAD `a33877487e332bf8c2cbc326323487fead2f72f9`.
- Branche distante inchangée après H1, checks conformes, aucun conflit.
- Vérifier dans Render si `main` déclenche un auto-deploy. État actuel : `AUTO_DEPLOY_BEHAVIOR: NOT_VERIFIED`.
- Si le HEAD change après H1 : répéter H1 intégralement.

### Modèle d’autorisation H2

> J’autorise le merge de `codex/p1-autonomous` au HEAD `a33877487e332bf8c2cbc326323487fead2f72f9` vers `main`, par merge commit, sans déploiement manuel.

Cette phrase est un modèle futur, pas une autorisation actuelle.

### Exécution H2B future

1. Dans la PR vérifiée, cliquer **Merge pull request** ou son équivalent actuel.
2. Vérifier le message et les branches.
3. Cliquer **Confirm merge** seulement si le HEAD est inchangé.
4. Ne pas supprimer la branche dans la même action.

### Vérification et STOP

- Relever le commit de merge, le HEAD de `main`, le statut PR et les checks.
- Vérifier immédiatement qu’aucun déploiement inattendu n’a démarré.
- `STOP_IF` : bouton propose squash/rebase seulement, nouveau commit, conflit, check rouge, auto-deploy non maîtrisé.
- Rollback : ne pas réécrire `main`; préparer un revert via une mission séparée.

Capture `H2B-1` : PR fusionnée, commit de merge et éventuel état Render, secrets masqués.

Arrêtez-vous ici et envoyez la capture/résultat avant de poursuivre.

## 8. H3 — Ingestion officielle du document SNC

### Objectif

Créer officiellement `source` et `source_version` sur Mentor production via l’application authentifiée, sans SQL ni UUID forcé.

### Prérequis

- Document local : `content-sources/COMPREHENSION COURS PEBC/SYSTÈME NERVEUX CENTRAL.pdf`.
- SHA-256 attendu : `1e194e6192ea11b3f8a33fce78fdd4ffa332b83f1f9b38e1836b57fdac39c273`.
- Compte pilote actif, application prête, stockage persistant validé.
- Matière attendue : `Pharmacologie — SNC`. Si ce libellé n’existe pas, arrêter.
- Autorisation d’ingestion explicite distincte.

### Vérification locale future

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath "content-sources/COMPREHENSION COURS PEBC/SYSTÈME NERVEUX CENTRAL.pdf"
```

Le hash doit correspondre exactement. Cette commande n’a pas été exécutée pendant la préparation du runbook.

### Procédure UI officielle

1. Ouvrir Mentor production et se connecter normalement ; ne copier aucun cookie ou token.
2. Ouvrir **Bibliothèque**.
3. Sélectionner la matière `Pharmacologie — SNC`.
4. Cliquer **Importer**.
5. Choisir uniquement le PDF SNC vérifié.
6. Attendre le résultat terminal ; ne pas recliquer pendant l’import.
7. Relever uniquement `status`, `sourceId`, `sourceVersionId` et `traceId` sûr.

La route officielle est `POST /api/documents`, formulaire multipart : champ `files` et champ `subject`. Le navigateur gère la session Auth0. L’API limite chaque fichier à la taille autorisée et utilise le pipeline officiel `ImportDocuments`.

### DevTools facultatif

1. Ouvrir **Network** avant le clic.
2. Sélectionner `POST /api/documents`, puis **Response**.
3. Lire seulement `documents[0].sourceId`, `documents[0].sourceVersionId`, `documents[0].status` et `traceId`.
4. Ne jamais ouvrir, copier ou transmettre Cookies, Authorization ou Request Headers sensibles.

### Attendu / STOP

- Attendu : source `READY`, extraction `COMPLETED`, identifiants présents, checksum concordant, environ 49 pages.
- Le contrôle post-ingestion doit être une mission read-only séparée, adaptée au schéma réel v16, avec `integrity_check`.
- `STOP_IF` : checksum différent, upload refusé, sujet incorrect, statut non `READY`, OCR inattendu, doublon ambigu, identifiant absent, pagination inattendue ou intégrité DB douteuse.
- Ne pas réessayer à l’aveugle.
- Rollback : utiliser uniquement le workflow applicatif officiel de suppression/archivage après analyse ; jamais de SQL manuel.

### Modèle d’autorisation H3

> J’autorise l’ingestion officielle du PDF SNC au checksum `1e194e…c273` dans la base Render réelle via **Bibliothèque → Importer**, et aucune autre mutation.

### Retour attendu

Transmettre uniquement `sourceId`, `sourceVersionId`, `status` et `traceId` sûr.

`NEXT_CODEX_PROMPT_REQUIRED: YES`

> Continue la réconciliation de provenance SNC avec `sourceVersionId = <TARGET_SOURCE_VERSION_ID>`, en lecture seule jusqu’au prochain human gate.

Arrêtez-vous ici et envoyez la capture/résultat avant de poursuivre.

## 9. H4 — Décision P1-05 sur une session MCQ persistée

| Option | UX | Sécurité des données | Complexité | Réalisme examen | Risque |
| --- | --- | --- | --- | --- | --- |
| `AUTO_RESUME` | Rapide mais surprenant | Préserve la session | Faible à moyenne | Bon | Reprise involontaire |
| `ASK_LEARNER` | Explicite et contrôlable | Préserve l’historique et le choix | Moyenne | Bon | UI supplémentaire |
| `START_NEW` | Simple en apparence | Risque d’abandon implicite | Faible à moyenne | Variable | Sessions orphelines |

**Recommandation non contraignante : `ASK_LEARNER`.** Elle rend l’état persistant visible, évite une perte implicite et laisse l’apprenant choisir. La création d’une nouvelle session doit conserver/terminer explicitement l’ancienne selon une règle ultérieure.

Modèle de décision :

> Pour P1-05, je choisis `ASK_LEARNER` : si une session MCQ incomplète existe, afficher une proposition de reprise ou de démarrage d’une nouvelle session. Cette décision n’autorise aucune écriture production.

À transmettre : option choisie et comportement attendu pour l’ancienne session. `HUMAN_DECISION_REQUIRED: YES`.

Arrêtez-vous ici et envoyez la décision avant toute implémentation.

## 10. H5 — Décision de convergence Examen blanc / MCQ Core

| Option | Duplication/cohérence | Persistance et clés | Timing examen | Risque/coût |
| --- | --- | --- | --- | --- |
| A — convergence complète immédiate | Meilleure cible | Unifie scoring, sessions et sécurité | À intégrer immédiatement | Élevé |
| B — flux séparé durable | Duplication persistante | Deux contrats à maintenir | Simple localement | Dette élevée |
| C — convergence progressive | Réduit graduellement la duplication | Réutilise MCQ Core derrière un adaptateur | Conserve les contraintes d’examen | Moyen |

**Recommandation non contraignante : option C.** Réutiliser MCQ Core pour items, ownership, soumission et correction, avec un adaptateur étroit pour durée et règles d’examen blanc. Cela limite la migration et protège les clés sans maintenir un second moteur durable.

Modèle de décision :

> Je choisis une convergence progressive de l’Examen blanc vers MCQ Core, avec un adaptateur spécifique aux contraintes d’examen. Cette décision n’autorise ni code, ni merge, ni déploiement.

À transmettre : option, contraintes de durée, taille d’examen et comportement de reprise. `HUMAN_DECISION_REQUIRED: YES`.

Arrêtez-vous ici et envoyez la décision avant toute implémentation.

## 11. H6 — Revue, autorisation et push post-P1

### Objectif et dépendance technique

La branche locale contient les états vides Progress, la robustesse Coach, la stabilisation de timeouts SQLite et le correctif terminal/état vide Examen blanc. Sa clôture technique est verte ; son push doit encore attendre la revue finale humaine puis une autorisation explicite.

### Contrôles futurs H6A

```powershell
git branch --show-current
git rev-parse HEAD
git status --short
git log --oneline a33877487e332bf8c2cbc326323487fead2f72f9..HEAD
```

- Branche attendue : `codex/post-p1-autonomous`.
- Relever le HEAD avec `git rev-parse HEAD`, le consigner comme `<REVIEWED_HEAD>` et refaire la revue s’il change ensuite.
- Aucun fichier suivi non commité, secret, DB ou groupe protégé indexé.
- Vérifier les résultats ciblés, typecheck, lint, suite globale et build réellement les plus récents.
- Référence technique actuelle : tests globaux 629/629, typecheck et lint réussis, build précédent 22/22 réutilisable car le dernier changement est exclusivement un timeout de test.

### STOP

Arrêter si branche/HEAD incorrect, worktree suivi sale, commit inconnu, test/typecheck/lint/build requis en échec, full suite non résolue, secret, remote inattendu ou force push nécessaire.

### Modèle d’autorisation H6B

> J’autorise le push normal de `codex/post-p1-autonomous` au HEAD `<REVIEWED_HEAD>` vers `origin/codex/post-p1-autonomous`, sans merge ni déploiement.

### Commande future H6C

```powershell
git push -u origin codex/post-p1-autonomous
```

Vérifier ensuite que le HEAD distant égale exactement `<REVIEWED_HEAD>` et que `origin/main` n’a pas changé. Ne jamais forcer.

Rollback : une branche publiée peut être abandonnée ou supprimée dans une autorisation distincte ; ne pas réécrire l’historique partagé.

Capture `H6-1` : branche et HEAD revus. Capture `H6-2` : branche distante et HEAD après push. Ne créer la PR qu’après une action humaine séparée.

Arrêtez-vous ici et envoyez les résultats avant de poursuivre.

## 12. Gates futurs SNC

### H3B — Projection immuable

- Entrée : nouveau UUID réel issu de H3.
- Créer de nouveaux artefacts V1/V2 ; conserver les originaux.
- Seul `sourceVersionId` peut changer ; aucun stem, option, clé, explication, mapping ou contenu clinique.
- Revue déterministe et dry-run avant publication.
- STOP si une différence clinique apparaît.

### H3C — Publication des artefacts

- Revue humaine du diff et des dry-runs.
- Autorisation séparée de commit/push/merge ; aucun déploiement implicite accepté.

### H3D — Backup frais

- Créer un nouveau backup officiel immédiatement avant l’import ; l’ancien `BKP-20260902032550354-c9db9be2` ne suffit pas automatiquement.
- Vérifier `COMPLETE`, checksum, schéma, empreinte et `integrity_check`.
- STOP si la DB a changé entre backup et import.

### H3E — Import V1

Modèle :

> J’autorise l’import réel du corpus SNC V1 projeté dans la base Render identifiée, après vérification du backup `<BACKUP_ID>`, et aucune autre écriture.

- Vérifier transaction, 10/10 items V1, FK, intégrité et absence d’écriture partielle.
- En cas d’échec : arrêter ; restaurer uniquement vers staging après autorisation.

### H3F — Import V2

Modèle :

> J’autorise l’import réel du corpus SNC V2 PUBLISHED après validation complète de V1 et du backup `<BACKUP_ID>`, et aucune autre écriture.

- Vérifier 10/10 dernières versions PUBLISHED, catalogue jouable, absence de fuite pré-soumission et correction post-soumission.
- Ne jamais enchaîner V1 et V2 sous une autorisation globale.

## 13. Gates futurs de déploiement

1. Avant merge, vérifier dans Render **Settings/Deploys** si Auto-Deploy de `main` est actif. Ne rien changer pendant cette vérification.
2. H2B ne doit pas être exécuté en croyant qu’il est sans déploiement si Auto-Deploy est actif.
3. D1 doit nommer commit, environnement, fenêtre et rollback.
4. D2 : déployer uniquement le commit autorisé ; ne lancer aucune migration implicite.
5. D3 : vérifier `/api/health`, `/api/readiness`, logs expurgés, authentification et smoke tests autorisés.
6. Rollback : revenir au dernier déploiement sain via Render ; une restauration DB reste une procédure séparée vers staging.

Modèle D1 :

> J’autorise le déploiement Render du commit `<COMMIT_SHA>` sur le service pilote, sans migration ni import de contenu.

Capture `D-1` : configuration Auto-Deploy. Capture `D-2` : commit du déploiement. Capture `D-3` : health/readiness et statut final, sans secret.

Arrêtez-vous après chaque capture et transmettez le résultat avant l’étape suivante.

## 14. Matrice des captures

| Checkpoint | Capture expurgée | Informations à transmettre |
| --- | --- | --- |
| H1-1 | Compare `main...codex/p1-autonomous` | branches, HEAD |
| H1-2 | Files changed | nombre et périmètre |
| H1-3 | Checks/conflicts | statuts uniquement |
| H2B-1 | PR fusionnée | commit de merge, main HEAD |
| H3-1 | Hash local | hash seulement |
| H3-2 | Résultat d’import Mentor | status, sourceId, sourceVersionId, traceId sûr |
| H6-1 | Préflight local | branche, HEAD, statut suivi |
| H6-2 | Branche distante | remote HEAD |
| D-1 | Auto-Deploy | actif/inactif, branche |
| D-2 | Deploy | commit et état |
| D-3 | Health/readiness | HTTP, codes sûrs, traceId |

## 15. Matrice de rollback

| Action | Rollback disponible | Règle |
| --- | --- | --- |
| Revue/décision | N/A | Aucun état muté |
| Push de branche | Partiel | Ne jamais forcer ; suppression séparée si autorisée |
| Merge vers main | Oui par revert | Nouvelle mission et revue ; jamais reset |
| Déploiement | Oui vers déploiement sain | Vérifier la DB séparément |
| Ingestion document | Workflow applicatif seulement | Jamais de DELETE SQL improvisé |
| Import MCQ | Backup vérifié vers staging | Aucun remplacement automatique de la base active |

## 16. Autorisations futures — modèles

- H2 : `J’autorise le merge de codex/p1-autonomous au HEAD a338774... vers main, par merge commit.`
- H3 : `J’autorise uniquement l’ingestion officielle du PDF SNC vérifié via /library.`
- H6 : `J’autorise le push normal de codex/post-p1-autonomous au HEAD <REVIEWED_HEAD> vers origin.`
- H3E : `J’autorise uniquement l’import SNC V1 après backup vérifié <BACKUP_ID>.`
- H3F : `J’autorise uniquement l’import SNC V2 après validation complète de V1.`
- D1 : `J’autorise uniquement le déploiement Render du commit <COMMIT_SHA>, sans migration ni import.`

Ces formulations sont des exemples. Elles n’accordent aucune autorisation maintenant.

## 17. Ce qu’il faut rapporter à ChatGPT/Codex

- Git : branche, SHA complet, liste/résumé des fichiers, checks, conflits.
- Ingestion : checksum, status, `sourceId`, `sourceVersionId`, traceId sûr.
- Backup : ID, statut VERIFIED, checksum, version, expiration si applicable.
- Import : artefact exact, résultat, nombre d’items, intégrité, aucune écriture partielle.
- Déploiement : commit, état Render, HTTP health/readiness, traceId sûr.
- Ne jamais transmettre cookies, tokens, secrets, en-têtes d’autorisation ou données personnelles.

## 18. Checklist finale et état de préparation

| Action | État actuel | Première condition suivante |
| --- | --- | --- |
| `P1_REMOTE_HUMAN_REVIEW` | READY | Propriétaire disponible |
| `P1_MERGE_AUTHORIZATION` | WAITING_PREVIOUS_ACTION | H1 PASS, HEAD inchangé, Auto-Deploy connu |
| `SNC_RENDER_OFFICIAL_INGESTION` | TECHNICALLY_READY_BUT_DEFERRED | Autorisation H3 et session active |
| `P1_05_RESUME_PERSISTED_MCQ_DECISION` | READY_FOR_DECISION | Choix humain |
| `MOCK_MCQ_CONVERGENCE_DECISION` | READY_FOR_DECISION | Choix humain |
| `POST_P1_BRANCH_PUSH_AUTHORIZATION` | WAITING_PREVIOUS_ACTION | H6A PASS sur le HEAD final |
| Imports SNC | WAITING_PREVIOUS_ACTION | H3, projection, publication, backup |
| Déploiement | WAITING_PREVIOUS_ACTION | merge/revue et autorisation dédiée |

Première action humaine recommandée lorsque le propriétaire sera prêt : **H1 — revue distante P1**. H4 et H5 peuvent être décidées en parallèle. Aucun travail autonome supplémentaire n’est requis avant la revue humaine post-P1.

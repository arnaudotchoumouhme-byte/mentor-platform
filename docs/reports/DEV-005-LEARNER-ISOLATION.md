# DEV-005 — Isolation des données par learner_id

## Objectif et périmètre

Fermer les accès croisés entre apprenants sur les chemins privés actifs du pilote, sans toucher aux corpus, à `data/mentor.db`, à Render ou au déploiement. Branche examinée : `main`.

## Cartographie et constats

| Surface privée | Stockage | Résultat |
| --- | --- | --- |
| MCQ sessions, réponses, progression et reprise | tables MCQ modernes avec `learner_id` | SAFE, ownership serveur déjà appliqué |
| Foundation diagnostics, maîtrise, recommandations, progression et exit assessment | tables Foundation avec `learner_id` | SAFE, identité autoritative déjà appliquée |
| OSCE sessions et interactions | tables OSCE avec `learner_id` | SAFE, ownership déjà appliqué |
| Calculations attempts/retests | tables Calculations avec `learner_id` | SAFE, identité serveur déjà appliquée |
| Documents et recherche | `documents` | VULNERABLE corrigé par ownership explicite |
| Flashcards, attempts/mock progress, weaknesses, study tasks | tables legacy correspondantes | VULNERABLE corrigé par ownership explicite |
| Conversations IA et settings | `conversations`, `settings` | VULNERABLE corrigé par ownership explicite |
| Coaching sessions | `coaching_sessions` | VULNERABLE corrigé par ownership explicite |

Les lignes legacy existantes sans preuve de propriétaire restent volontairement non associées et donc invisibles : aucune attribution au premier compte, à l'utilisateur courant ou à un identifiant inventé.

## Corrections

- L'identité `learnerId` provient exclusivement de `requirePilotIdentity()` aux frontières API.
- Les lectures, listes et mutations legacy sont contraintes par ownership au repository.
- Les créations de ressources privées et de leur ownership sont transactionnelles.
- Les opérations coach vérifient l'ownership avant chargement ou reprise.
- Les documents importés par une route apprenant reçoivent leur ownership lors de la finalisation transactionnelle.
- Les imports système sans apprenant restent non associés et ne deviennent pas privés arbitrairement.
- Les conversations IA sont associées à l'apprenant dans la même transaction.

## Migration

`MIG-0016`, additive v15 → v16, crée huit tables dédiées d'ownership/settings avec FK vers `accounts(learner_id)`. Elle ne réécrit ni ne supprime aucune donnée existante. Aucune migration historique MIG-0001 à MIG-0015 n'a été modifiée fonctionnellement par DEV-005.

Préparation contrôlée sur `C:\Users\otcho\AppData\Local\Temp\mentor-local-preview-recovery\mentor-staging-v14.db` :

- plan : `EXECUTE MIG-0016` uniquement ;
- activation : `eaf251a4-affd-438f-a780-e62a7b8de3e0` ;
- identité DB : `53ff6a7c591aefcfac0c53f0afbd2ff14f440a2153071a080c1a519f2483d824` ;
- hash du plan : `2727b10f40b1f131331deca6f27196871dfd0b330f609774ae0350b712ae7ea0` ;
- backup : `BKP-20260830134318120-fd2db834`, `VERIFIED` ;
- checksum backup : `b5eed2442805a2f6e7929229f6d38028da095e2473ce862a2b5da38721527c6d` ;
- expiration : `2026-08-30T13:58:18.245Z`.

`execute()` n'a pas été appelé.

## Validation

- Tests ciblés : 18 fichiers, 103/103 réussis.
- Matrice A/B : listes séparées, lecture et écriture B → A refusées, données legacy non associées invisibles.
- MCQ : GET/answer/complete vérifient l'ownership ; soumission croisée refusée ; clé protégée avant soumission.
- TypeScript complet : réussi (`tsc --noEmit`).
- ESLint ciblé : réussi.
- `git diff --check` : réussi ; uniquement avertissements de conversion LF/CRLF.
- Build : non exécuté, non nécessaire au périmètre.

## Fichiers et exclusions

DEV-005 concerne 36 fichiers de code/tests, plus ce rapport. Les changements antérieurs DEV-003/DEV-004 ont été préservés. Sont explicitement exclus : `data/`, corpus SNC protégés, `.tmp-migration-runner/`, `backups/`, `DOCS1/`, `dossier evolution/`, `mentor-platform-restaure/`, Render et tout déploiement.

## Risques résiduels et verdict

Une reprise crash d'un import documentaire privé interrompu avant la finalisation d'ownership peut produire un document non associé ; il reste inaccessible (fail closed), mais peut nécessiter une récupération opérateur. Aucun risque résiduel de fuite cross-learner démontré dans le périmètre testé.

Verdict : **non validable tant que MIG-0016 n'est pas explicitement autorisée et activée sur la staging**.

## DEV-005B — MIG-0016 ACTIVATION

Une nouvelle préparation contrôlée a créé le backup vérifié `BKP-20260830142055995-47b3c1fa`. Les conditions autorisées ont toutes été satisfaites avant exécution : identité DB `53ff6a7c591aefcfac0c53f0afbd2ff14f440a2153071a080c1a519f2483d824`, plan `2727b10f40b1f131331deca6f27196871dfd0b330f609774ae0350b712ae7ea0`, version 15, cible 16, MIG-0016 seule et intégrité `ok`.

`ControlledMigrationActivation.execute()` a été appelé une fois. Une erreur de syntaxe dans la première requête de lecture post-validation a empêché de conserver l'activationId dans la sortie de commande, sans affecter l'exécution. La vérification read-only indépendante confirme ensuite : schéma 16, MIG-0016 enregistrée 15 → 16, `integrity_check=ok`, aucune violation FK, huit tables attendues présentes, sept index attendus présents et zéro ligne dans toutes les tables d'ownership/settings. Aucune donnée legacy n'a donc été attribuée automatiquement.

Smoke de sécurité post-migration : 5 fichiers ciblés, 15/15 tests réussis. L'isolation A/B, l'ownership MCQ et la protection de la clé avant soumission restent valides. `data/mentor.db` n'a pas été ouverte.

Verdict final DEV-005 : **PASS**.

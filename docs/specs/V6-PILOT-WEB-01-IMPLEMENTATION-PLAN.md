# V6 — PILOT-WEB-01 — Plan d'implémentation

## 1. Problème à résoudre

Permettre à 4–20 utilisateurs explicitement admis d'utiliser Foundation, MCQ, OSCE textuel et Calculations avec une identité serveur fiable, une isolation stricte, une persistence durable, des quotas et une mesure minimale des coûts. Le dépôt actuel est une application locale mono-instance : le `learnerId` est souvent fourni par le client et ne constitue pas une authentification.

## 2. Architecture actuelle réutilisable

- monolithe modulaire Next.js App Router ; séparation domain/application/infrastructure/presentation ;
- routes API Zod, erreurs sûres, `trace_id`, CSP et logger structuré avec redaction ;
- SQLite et migrations contrôlées ; repositories Foundation, MCQ, OSCE et Calculations déjà indexés par `learnerId` ;
- contrôles d'ownership applicatifs partiels, notamment OSCE ;
- boucles progression, assessment, replay et remediation existantes.

## 3. Gaps réels

- aucun compte, authentificateur, session serveur ou allowlist de pilote ;
- aucune relation vérifiée `authenticatedUser → learnerId` ;
- routes acceptant encore une identité client forgeable ;
- SQLite configurée dans `/tmp` sur Vercel : persistence non durable et non partageable entre instances ;
- aucune synchronisation multi-client explicitée ;
- aucun quota persistant ni ledger de métadonnées d'usage/coût ;
- aucune UI d'entrée/authentification ni état « quota atteint ».

## 4. Architecture minimale proposée

Conserver le monolithe. Ajouter une frontière d'identité serveur unique qui valide la session du fournisseur retenu, résout un compte local allowlisté et fournit un `learnerId` opaque. Les routes passent ce contexte aux use cases ; elles n'acceptent plus le `learnerId` client comme preuve. Utiliser une seule base durable et une stratégie lecture/écriture serveur synchrone. Aucun bus, microservice, CRDT, RBAC générique ni billing.

Flux : `session authentifiée → compte PILOT_ACTIVE → learnerId → ownership → quota → use case existant → usage metadata`.

## 5. Comptes et authentification — décision humaine 1

Modèle minimal local : `accountId`, `externalSubject`, `learnerId`, `status` (`INVITED|ACTIVE|DISABLED`), `createdAt`, `updatedAt`. Provisionnement manuel/allowlist ; aucune inscription publique.

### Option A — fournisseur OIDC managé

- Avantage : sessions, cookies et sécurité d'identité maintenus par un spécialiste ; mise en route adaptée au pilote.
- Inconvénient : fournisseur, secrets, politique de données et coût à valider.
- Coût/complexité : faible à modéré ; SDK ou intégration OIDC ciblée.
- Recommandation : **oui pour le pilote**, après choix humain du fournisseur et validation privacy/région.

### Option B — passerelle OIDC auto-hébergée

- Avantage : contrôle accru de l'hébergement et des données d'identité.
- Inconvénient : exploitation, mises à jour, disponibilité et sécurité à notre charge.
- Coût/complexité : élevé pour 4–20 utilisateurs.
- Recommandation : non, sauf contrainte réglementaire démontrée.

Interdit : mot de passe maison, token artisanal, secret hardcodé ou identité déclarée par le client.

## 6. Authorization et isolation

Créer un résolveur serveur étroit `AuthenticatedPilotIdentity` retournant seulement `accountId` et `learnerId`. Réutiliser les checks métier existants et compléter les accès Foundation, MCQ, Calculations, OSCE, remediation, assessment et replay. Toute ressource est chargée puis comparée au `learnerId` authentifié ; mismatch et compte désactivé échouent sans révéler l'existence de la ressource.

## 7. Persistence, synchronisation et hébergement — décision humaine 2

Source de vérité unique côté serveur. Écritures synchrones transactionnelles ; lectures après écriture ; conflit minimal par contrainte unique et version/timestamp seulement lorsque deux clients peuvent modifier la même ressource. Pas de mode offline complexe.

### Option A — instance Web unique avec volume persistant chiffré et SQLite

- Avantage : réutilise toute la persistence actuelle ; changement minimal et rollback simple.
- Inconvénient : impose un hébergeur stateful, une seule instance d'écriture, backups et supervision opérés.
- Coût/complexité : faible ; suffisant pour 4–20 utilisateurs.
- Recommandation : **oui pour le pilote fermé**, si l'hébergeur et la durabilité du volume sont validés.

### Option B — PostgreSQL managé

- Avantage : persistence distante durable, concurrence et montée en charge mieux établies.
- Inconvénient : nouveaux adapters, migration de données, exploitation et dépendance fournisseur ; périmètre nettement supérieur.
- Coût/complexité : modéré à élevé.
- Recommandation : différer jusqu'à preuve que l'instance unique ne suffit pas.

Décisions associées à valider : hébergeur, région, chiffrement, sauvegardes, rétention, secrets production et domaine/DNS. Aucun fournisseur n'est choisi par ce plan.

## 8. Quotas

Quota persistant simple par `accountId`, `quotaType`, fenêtre UTC, `consumed`, `limit`, `updatedAt`. Consommation atomique avant opération coûteuse ; refus fail-closed à la limite. Types initiaux uniquement démontrés par le pilote : `OSCE_SESSION` et `AI_REQUEST` si un connecteur IA externe est réellement activé. Pas de facturation.

## 9. Observabilité des coûts

Ledger append-only minimal : compte/learner opaques, feature, provider/model nullable, input/output usage nullable, coût estimé nullable, latence, résultat, `traceId`, timestamp. Ne jamais stocker prompts, réponses, contenu clinique, cookie, token ou secret. Les opérations déterministes locales déclarent coût externe nul sans simuler une consommation IA.

## 10. Sécurité et privacy

- cookies de session serveur sécurisés selon le fournisseur ; aucune identité client faisant autorité ;
- allowlist et état du compte contrôlés à chaque requête protégée ;
- validation stricte, tailles maximales, erreurs internes masquées et logs redacted ;
- minimisation, rétention et suppression à définir avant pilote ;
- tests : non authentifié, identité forgée, cross-user lecture/écriture, UUID étranger, session/replay étrangers, quota bypass, payload invalide/surdimensionné et secret leakage.

## 11. Migration candidate

Une migration additive est nécessaire après validation humaine : **MIG-0012, v11 → v12**. Changements envisagés uniquement : comptes/liaison learner, quotas et ledger d'usage/coût, avec contraintes et index d'ownership. Aucun changement destructif des tables MIG-0001 à MIG-0011. La migration devra être testée sur bases synthétiques puis activée séparément par le mécanisme contrôlé.

## 12. Dépendances et fournisseurs

Une dépendance d'auth peut être nécessaire selon l'option retenue ; aucune n'est installée avant décision. Aucun nouveau fournisseur de base n'est requis avec l'option SQLite stateful. L'email transactionnel n'est pas nécessaire : les 4–20 comptes peuvent être provisionnés manuellement.

## 13. Stratégie de pilote fermé

Comptes créés explicitement, statut désactivable, aucune inscription publique. Commencer avec 4 utilisateurs, observer erreurs/coûts, puis étendre jusqu'à 20. Un commutateur serveur désactive le pilote ou une feature coûteuse sans effacer les historiques.

## 14. Rollback

Avant MIG-0012 : preflight et backup vérifié. Rollback applicatif : désactiver l'accès pilote et revenir au commit précédent. En cas de migration défaillante : restauration uniquement vers staging puis décision humaine, jamais remplacement automatique de la base active. Les tables additives restent sans incidence sur les modules historiques lorsque le pilote est désactivé.

## 15. Tests et quality gates

Tests ciblés : auth/session, allowlist, mapping learner, ownership A/B pour chaque module, quota atomique/bypass, ledger sans contenu sensible, persistence/reprise et désactivation. Puis une fois : typecheck, lint, tests globaux et build Web. Toute commande SQLite utilise une base synthétique avec `MENTOR_ENABLE_DEMO_DATA=0` et `MENTOR_DATA_DIRECTORY` temporaire absolu.

## 16. Critères d'acceptation

- utilisateur authentifié et allowlisté ; compte désactivable ;
- `learnerId` résolu côté serveur et non forgeable ;
- aucune lecture/écriture cross-user sur Foundation, MCQ, OSCE, Calculations et remediation ;
- persistence durable et reprise déterministe ;
- quotas fail-closed et usage/coût observable sans données sensibles ;
- UI minimale d'entrée, navigation existante et erreurs/quota compréhensibles ;
- boucles d'apprentissage existantes préservées ;
- 4–20 utilisateurs possibles, sans inscription publique ;
- MIG-0012 additive validée séparément ; quality gates verts ; base utilisateur jamais utilisée pendant le BUILD.

## Décisions humaines requises avant BUILD

1. Choisir le mécanisme/fournisseur OIDC et valider région, privacy, secrets et politique de session.
2. Choisir l'hébergement : instance unique stateful + volume SQLite (recommandé pilote) ou PostgreSQL managé.
3. Valider le modèle minimal Accounts/quotas/usage et autoriser la conception de MIG-0012 v11→v12.

Question de simplicité : cette proposition évite-t-elle toute couche non nécessaire ? **Oui** : un monolithe, une identité serveur, une source de vérité, trois tables fonctionnelles minimales et aucun système distribué ou billing.

# RUN-COACH — diagnostiquer une mauvaise réponse

1. Vérifier le `traceId` et `sessionId`, sans copier le contenu clinique dans les logs.
2. **Evidence failure** : contrôler l'index, l'EvidenceGate et les citations. Une preuve insuffisante doit entraîner une abstention.
3. **Missing patient data** : vérifier `requiredData`. Ne pas confondre ce cas avec une règle absente.
4. **Medication review** : contrôler les règles actives, agents normalisés et SourceVersion citées.
5. **Orchestration** : vérifier `currentStep`, `mode`, `hintLevel`, `attemptCount` et `sessionVersion`.
6. **Provider/schema** : le provider déterministe doit retourner un `CoachStep`; une future sortie LLM invalide doit être rejetée.
7. **Learner state** : contrôler le signal enregistré, l'erreur classifiée et la remédiation.
8. **Persistence** : reprendre la session et comparer mode, cas, étape, indices, réponses, preuves et teach-back en attente.

Ne jamais diagnostiquer avec une donnée de patient réel. Reproduire uniquement avec les fixtures synthétiques versionnées.

# RUN-AI — RAG et appels IA

## Diagnostic

1. Relever le `traceId` affiché sans copier question, prompt, réponse ou document.
2. Distinguer `RAG_NO_DOCUMENTS`, `RAG_NO_EVIDENCE`, `AI_PROVIDER_TIMEOUT`, `AI_PROVIDER_UNAVAILABLE` et `NET_REQUEST_FAILED`.
3. Suivre les événements structurés RAG puis IA avec le même `traceId`; ne jamais classer un corpus vide comme panne fournisseur.
4. Vérifier configuration, corpus/index, latence et quota séparément.
5. Retry uniquement si `retriable=true`; ne jamais journaliser clé API, token, prompt ou contenu clinique.

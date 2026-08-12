# RUN-RAG

1. Importer un TXT, PDF ou DOCX et attendre l'état `READY`.
2. Poser une question dans `/ai`. La première requête indexe les versions `NOT_INDEXED`, `STALE` ou `INDEX_FAILED`.
3. Contrôler les événements structurés portant le même `traceId` : démarrage, indexation, recherche lexicale/vectorielle, fusion, porte de preuve, contexte, citations et réponse.
4. En cas de refus inattendu, vérifier `source_versions.index_status`, le nombre de `document_chunks`, la présence des lignes FTS et le seuil documenté.
5. Pour reconstruire une version, la marquer `STALE`; la prochaine requête remplace ses chunks dans une transaction.

Ne jamais journaliser le texte des documents, la question brute, des secrets ou des données personnelles. Une absence de preuve est un résultat normal, pas une panne.

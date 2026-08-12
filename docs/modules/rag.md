# Module RAG local

Le pipeline part uniquement des `SourceVersion` actives et extraites. Il découpe le texte en chunks traçables, calcule un vecteur local déterministe, alimente SQLite FTS5, fusionne les résultats lexicaux et vectoriels, puis applique une porte de preuve avant toute réponse.

Flux : `SourceVersion → ParagraphChunker → SqliteChunkRepository → HybridRetriever → LocalEvidenceGate → TraceableCitationBuilder → AskAiTeacher`.

La réponse est extractive et locale. Le contenu documentaire est traité comme une donnée non fiable : une phrase ressemblant à une instruction dans un document n'est jamais exécutée. Si l'index est vide, si aucun candidat ne dépasse le seuil, si la couverture des termes est insuffisante ou si une citation ne peut pas être reliée à la version active, l'application répond explicitement « Appui documentaire insuffisant ».

Les vecteurs sont persistés avec le fournisseur utilisé. Une version `STALE` est réindexée transactionnellement ; les versions anciennes ou sources supprimées sont exclues des recherches. Le reranker est un port facultatif et reste désactivé dans ce lot.

Les limites connues sont documentées dans le runbook : le vecteur local est un feature embedding sans modèle neuronal, les pages ne sont renseignées que lorsque l'extracteur fournit une correspondance fiable, et FTS5 doit être disponible dans SQLite.

# Retrieval hybride

La recherche lexicale utilise SQLite FTS5 et BM25. La recherche vectorielle calcule une similarité cosinus sur des embeddings locaux de dimension 384. Les candidats sont fusionnés avec les poids versionnés `semantic=0.55` et `lexical=0.45`, puis limités à cinq passages.

La porte de preuve exige un score minimal de `0.38` et une couverture suffisante des termes significatifs. Cette règle privilégie un faux négatif explicite à une réponse non étayée. Les métriques déterministes disponibles sont Recall@K, Precision@K et MRR ; les cas sans preuve et l'exactitude des citations sont couverts par les tests du pipeline.

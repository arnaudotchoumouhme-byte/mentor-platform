# ADR-0003 — RAG hybride local et preuve obligatoire

Statut : accepté pour le MVP local mono-utilisateur.

Décision : conserver les chunks, les vecteurs et FTS5 dans SQLite ; utiliser un fournisseur d'embeddings local interchangeable ; fusionner BM25 et cosinus avec des poids explicites ; interdire une réponse documentaire sous le seuil de preuve ; construire les citations depuis les enregistrements actifs persistés.

Motifs : fonctionnement hors réseau, confidentialité, reproductibilité et absence de coût externe. Le stockage JSON des vecteurs et le calcul cosinus en mémoire sont adaptés au corpus local actuel mais devront être remplacés par un index vectoriel spécialisé si le corpus devient volumineux. Un modèle neuronal local peut remplacer le fournisseur actuel sans modifier les cas d'usage.

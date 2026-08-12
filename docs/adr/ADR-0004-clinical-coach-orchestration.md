# ADR-0004 — Orchestration déterministe du Coach clinique

Statut : accepté pour le MVP local éducatif.

Décision : séparer l'orchestrateur, la session, le cas synthétique, la revue médicamenteuse, la sécurité, la preuve, l'évaluation et le provider. Les invariants critiques restent dans le domaine/application. SQLite persiste sessions et signaux. Le RAG Lot 3 est l'unique source des règles cliniques documentaires. Un provider déterministe assure le mode hors ligne; un LLM futur restera derrière `CoachProvider` et un schéma validé.

Conséquence : le moteur s'abstient lorsque la preuve manque et refuse toute précision lorsque les données patient synthétiques requises sont absentes.

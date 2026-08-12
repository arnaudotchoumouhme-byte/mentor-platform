# Pharmacien Coach Clinique

Le Coach est une simulation éducative pour patients exclusivement synthétiques. Il ne prescrit pas, ne diagnostique pas et ne remplace jamais une consultation professionnelle. Les utilisateurs ne doivent saisir aucun identifiant ou renseignement de patient réel.

`ClinicalCoachOrchestrator` maintient une séance persistante et orchestre des composants distincts : validation du cas, preuve RAG, revue médicamenteuse, sécurité, évaluation de réponse, remédiation, teach-back et transfert. Les modes `PROFESSOR`, `CLINICAL_PHARMACIST`, `SOCRATIC` et `TEACH_BACK` changent réellement la question, la progression et l'utilisation des indices. `RAPID_REVIEW` est préparé.

Le provider déterministe permet un fonctionnement et des tests hors ligne. Le registre de prompts documente les contrats futurs; aucune règle clinique critique n'est confiée à un prompt.

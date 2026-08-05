# Matrice de traçabilité MVP

| Exigence PRD | Implémentation | Validation |
|---|---|---|
| FEAT-001 / TEST-001-004 | Bibliothèque, import multiple, filtres, archivage, suppression | Parcours `/library` |
| FEAT-002 / TEST-005-008 | Validation format/taille, stockage local, états d’indexation | API `/api/documents` |
| FEAT-003 / TEST-009-012 | Recherche textuelle et filtre matière | `/search`, API `/api/search` |
| FEAT-009 / TEST-013-016 | Classement local, contexte, citations, absence de résultat | API `/api/ai` |
| FEAT-016 / TEST-017-020 | Six modes pédagogiques, historique, transparence | `/ai` |
| FEAT-017 / TEST-021-024 | QCM, correction, source, enregistrement du résultat | `/quizzes` |
| FEAT-018 / TEST-025-028 | Cas clinique, réponse, raisonnement et source | `/clinical-cases` |
| FEAT-019 / TEST-029-032 | Flashcards et répétition espacée configurable | `/flashcards`, tests unitaires |
| FEAT-020 / TEST-033-036 | Progression globale/par matière et historique | `/progress` |
| FEAT-021 / TEST-037-040 | Confiance, cause, action, résolution | `/weaknesses` |
| FEAT-022 / TEST-041-044 | Activités datées, durées, priorités, accomplissement | `/study-plan` |
| FEAT-023 / TEST-045-048 | Session d’examen et intégration du résultat | `/mock-exams` |
| SCR-001-012 / TEST-049-052 | Navigation responsive, états vides/erreurs, actions principales | Toutes les routes |
| DATA-001-025 | Schéma SQLite local couvrant les agrégats du MVP | `src/lib/db.ts` |
| SEC / ERR-072-080 | Secrets serveur, validation Zod, formats/taille, budget visible | `.env.example`, API, paramètres |

## Hypothèses explicites

- Le MVP est livré comme application web locale Next.js sous Windows. L’emballage Tauri est reporté au lot de distribution, sans incidence sur le domaine ou la base.
- L’IA distante est désactivée par défaut pour garantir l’absence de coût et le fonctionnement hors ligne.
- Les fichiers TXT/Markdown sont indexés immédiatement. Le pipeline d’extraction PDF/DOCX/OCR est représenté par des états explicites et constitue le prochain lot technique.
- Le profil local unique est implicite dans ce MVP; le modèle reste compatible avec un futur `LocalUser` et des workspaces isolés.

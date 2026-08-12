/**
 * Dataset synthétique du mode démonstration local.
 * Ces entrées ne représentent pas des fichiers importés ni des sources officielles.
 */
export const LOCAL_DEMO_SEED_SQL = `
  INSERT INTO subjects (name, color, mastery) VALUES
    ('Pharmacologie', '#177a63', 72),
    ('Pharmacocinétique', '#c87838', 58),
    ('Législation', '#596fb2', 43),
    ('Pratique pharmaceutique', '#a65d78', 66);
  INSERT INTO documents (name, type, size, subject, status, content) VALUES
    ('[DÉMO] Guide PEBC - Pharmacologie.pdf', 'PDF', 2480000, 'Pharmacologie', 'Démonstration', 'Les bêtabloquants réduisent la fréquence cardiaque et la pression artérielle. Ils nécessitent une surveillance clinique et ne doivent pas être interrompus brutalement.'),
    ('[DÉMO] Notes de pharmacocinétique.docx', 'DOCX', 640000, 'Pharmacocinétique', 'Démonstration', 'La biodisponibilité décrit la fraction de la dose administrée qui atteint la circulation systémique. La clairance représente le volume de plasma épuré par unité de temps.'),
    ('[DÉMO] Législation canadienne.pdf', 'PDF', 1920000, 'Législation', 'Démonstration', 'La pratique pharmaceutique est encadrée par les autorités provinciales et des normes professionnelles applicables.'),
    ('[DÉMO] Fiches de pratique.md', 'MD', 18000, 'Pratique pharmaceutique', 'Démonstration', 'Une communication efficace avec le patient inclut la vérification de sa compréhension et une documentation appropriée.');
  INSERT INTO flashcards (front, back, subject, difficulty, due_at) VALUES
    ('Que représente la clairance?', 'Le volume de plasma complètement épuré d’une substance par unité de temps.', 'Pharmacocinétique', 'Moyen', date('now')),
    ('Pourquoi éviter l’arrêt brutal d’un bêtabloquant?', 'Pour prévenir un rebond adrénergique pouvant aggraver tachycardie ou hypertension.', 'Pharmacologie', 'Difficile', date('now')),
    ('Qui encadre principalement la pratique au Canada?', 'Les autorités de réglementation provinciales.', 'Législation', 'Facile', date('now', '+1 day'));
  INSERT INTO questions (prompt, options, answer, explanation, subject, difficulty, source) VALUES
    ('Quelle définition décrit le mieux la biodisponibilité?', '["La vitesse d’élimination","La fraction atteignant la circulation systémique","Le volume de distribution","La liaison protéique"]', 1, 'La biodisponibilité mesure la fraction de la dose qui atteint la circulation systémique.', 'Pharmacocinétique', 'Intermédiaire', '[DÉMO] Notes de pharmacocinétique.docx'),
    ('Quel conseil est prioritaire lors de l’arrêt d’un bêtabloquant?', '["Arrêt immédiat","Doublement de la dose","Diminution progressive supervisée","Prise uniquement au besoin"]', 2, 'Une diminution progressive limite le risque de rebond adrénergique.', 'Pharmacologie', 'Intermédiaire', '[DÉMO] Guide PEBC - Pharmacologie.pdf'),
    ('Quelle action soutient une bonne communication patient?', '["Employer uniquement des termes techniques","Vérifier la compréhension","Éviter les questions","Omettre la documentation"]', 1, 'La reformulation par le patient aide à confirmer sa compréhension.', 'Pratique pharmaceutique', 'Facile', '[DÉMO] Fiches de pratique.md');
  INSERT INTO attempts (module, subject, score, duration_minutes, created_at) VALUES
    ('QCM', 'Pharmacologie', 78, 24, datetime('now', '-4 days')),
    ('QCM', 'Pharmacocinétique', 62, 19, datetime('now', '-2 days')),
    ('Examen blanc', 'Mixte', 69, 80, datetime('now', '-1 day'));
  INSERT INTO weaknesses (subject, topic, confidence, cause, action) VALUES
    ('Législation', 'Champ d’exercice provincial', 'Élevé', 'Résultats faibles répétés', 'Relire la section législation puis faire un QCM ciblé'),
    ('Pharmacocinétique', 'Calcul de clairance', 'Moyen', 'Pratique insuffisante', 'Réviser 8 flashcards et résoudre 5 calculs');
  INSERT INTO study_tasks (title, subject, task_date, minutes, priority) VALUES
    ('Révision des bêtabloquants', 'Pharmacologie', date('now'), 35, 'Haute'),
    ('Flashcards de clairance', 'Pharmacocinétique', date('now'), 20, 'Haute'),
    ('Lecture du cadre provincial', 'Législation', date('now', '+1 day'), 40, 'Moyenne'),
    ('QCM mixte de 20 questions', 'Mixte', date('now', '+2 day'), 30, 'Moyenne');
  INSERT INTO settings (key, value) VALUES
    ('displayName', 'Étudiant PEBC'), ('language', 'fr'), ('dailyBudget', '2.00'),
    ('aiProvider', 'Mode local'), ('examDate', date('now', '+120 day'));
`;

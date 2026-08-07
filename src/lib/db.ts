import "server-only";

import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { config } from "@/infrastructure/config/server-config";

const dataDir = config.database.dataDirectory;

mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, config.database.filename);
const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

db.exec(`
  CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#177a63',
    mastery INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    size INTEGER NOT NULL DEFAULT 0,
    subject TEXT NOT NULL DEFAULT 'Non classé',
    status TEXT NOT NULL DEFAULT 'Prêt',
    content TEXT NOT NULL DEFAULT '',
    archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS flashcards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    subject TEXT NOT NULL,
    difficulty TEXT NOT NULL DEFAULT 'Moyen',
    due_at TEXT NOT NULL DEFAULT CURRENT_DATE,
    interval_days INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'active'
  );
  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prompt TEXT NOT NULL,
    options TEXT NOT NULL,
    answer INTEGER NOT NULL,
    explanation TEXT NOT NULL,
    subject TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    source TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    module TEXT NOT NULL,
    subject TEXT NOT NULL,
    score INTEGER NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS weaknesses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject TEXT NOT NULL,
    topic TEXT NOT NULL,
    confidence TEXT NOT NULL,
    cause TEXT NOT NULL,
    action TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS study_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    task_date TEXT NOT NULL,
    minutes INTEGER NOT NULL,
    priority TEXT NOT NULL DEFAULT 'Moyenne',
    status TEXT NOT NULL DEFAULT 'todo'
  );
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    citations TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

const count = Number((db.prepare("SELECT COUNT(*) AS count FROM subjects").get() as { count: number }).count);
if (count === 0) {
  db.exec(`
    INSERT INTO subjects (name, color, mastery) VALUES
      ('Pharmacologie', '#177a63', 72),
      ('Pharmacocinétique', '#c87838', 58),
      ('Législation', '#596fb2', 43),
      ('Pratique pharmaceutique', '#a65d78', 66);
    INSERT INTO documents (name, type, size, subject, status, content) VALUES
      ('Guide PEBC - Pharmacologie.pdf', 'PDF', 2480000, 'Pharmacologie', 'Prêt', 'Les bêtabloquants réduisent la fréquence cardiaque et la pression artérielle. Ils nécessitent une surveillance clinique et ne doivent pas être interrompus brutalement.'),
      ('Notes de pharmacocinétique.docx', 'DOCX', 640000, 'Pharmacocinétique', 'Prêt', 'La biodisponibilité décrit la fraction de la dose administrée qui atteint la circulation systémique. La clairance représente le volume de plasma épuré par unité de temps.'),
      ('Législation canadienne.pdf', 'PDF', 1920000, 'Législation', 'À vérifier', 'La pratique pharmaceutique est encadrée par les autorités provinciales et des normes professionnelles applicables.'),
      ('Fiches de pratique.md', 'MD', 18000, 'Pratique pharmaceutique', 'Prêt', 'Une communication efficace avec le patient inclut la vérification de sa compréhension et une documentation appropriée.');
    INSERT INTO flashcards (front, back, subject, difficulty, due_at) VALUES
      ('Que représente la clairance?', 'Le volume de plasma complètement épuré d’une substance par unité de temps.', 'Pharmacocinétique', 'Moyen', date('now')),
      ('Pourquoi éviter l’arrêt brutal d’un bêtabloquant?', 'Pour prévenir un rebond adrénergique pouvant aggraver tachycardie ou hypertension.', 'Pharmacologie', 'Difficile', date('now')),
      ('Qui encadre principalement la pratique au Canada?', 'Les autorités de réglementation provinciales.', 'Législation', 'Facile', date('now', '+1 day'));
    INSERT INTO questions (prompt, options, answer, explanation, subject, difficulty, source) VALUES
      ('Quelle définition décrit le mieux la biodisponibilité?', '["La vitesse d’élimination","La fraction atteignant la circulation systémique","Le volume de distribution","La liaison protéique"]', 1, 'La biodisponibilité mesure la fraction de la dose qui atteint la circulation systémique.', 'Pharmacocinétique', 'Intermédiaire', 'Notes de pharmacocinétique.docx'),
      ('Quel conseil est prioritaire lors de l’arrêt d’un bêtabloquant?', '["Arrêt immédiat","Doublement de la dose","Diminution progressive supervisée","Prise uniquement au besoin"]', 2, 'Une diminution progressive limite le risque de rebond adrénergique.', 'Pharmacologie', 'Intermédiaire', 'Guide PEBC - Pharmacologie.pdf'),
      ('Quelle action soutient une bonne communication patient?', '["Employer uniquement des termes techniques","Vérifier la compréhension","Éviter les questions","Omettre la documentation"]', 1, 'La reformulation par le patient aide à confirmer sa compréhension.', 'Pratique pharmaceutique', 'Facile', 'Fiches de pratique.md');
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
  `);
}

export function all<T>(sql: string, ...params: SQLInputValue[]): T[] {
  return db.prepare(sql).all(...params) as T[];
}

export function get<T>(sql: string, ...params: SQLInputValue[]): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined;
}

export function run(sql: string, ...params: SQLInputValue[]) {
  return db.prepare(sql).run(...params);
}

export { db };

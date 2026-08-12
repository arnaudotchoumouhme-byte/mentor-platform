# Pipeline d’ingestion

Route multipart → validation de domaine → SHA-256/doublon → extraction locale → normalisation → stockage exclusif → Source/SourceVersion SQLite.

La validation contrôle nom, extension unique, MIME déclaré, signature réelle, archive DOCX, taille, vide et signatures exécutables. PDF.js extrait par page; Mammoth extrait le texte DOCX; TXT/MD exigent UTF-8. Un PDF valide sans texte devient `REQUIRES_OCR`. Le timeout est de 15 secondes. Aucun contenu n’est envoyé au réseau ou inscrit dans les logs.

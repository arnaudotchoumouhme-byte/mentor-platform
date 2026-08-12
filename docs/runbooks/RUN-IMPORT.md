# RUN-IMPORT — Pourquoi mon PDF/DOCX n’est-il pas importé ou extrait ?

1. Relever `trace_id` et `error.code`, sans copier le contenu dans les logs.
2. Types : PDF textuel, DOCX sans macro, TXT UTF-8, Markdown. DOCM, doubles extensions et exécutables sont refusés.
3. Taille : 50 Mio maximum; l’enveloppe multipart est également limitée.
4. `MIME_MISMATCH` : désaccord type/extension. `CORRUPTED_FILE` : signature/archive invalide.
5. `FILE_DUPLICATE` : le même SHA-256 existe; rien n’est écrasé.
6. `INGEST_NO_TEXT_FOUND` : texte absent. `REQUIRES_OCR` : PDF valide sans couche texte; l’OCR est différé.
7. Pour le stockage, vérifier que `MENTOR_DATA_DIRECTORY` est absolu, accessible et dispose d’espace. Ne manipulez pas `.pending` manuellement.
8. Ne transmettez jamais un document utilisateur à un service externe pour le diagnostic.

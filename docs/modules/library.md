# Module Library

Chaque import réel possède un `source_id`, un `source_version_id`, une provenance `USER_UPLOAD`, un SHA-256, un statut d’extraction et le contenu normalisé de sa première version. Les anciennes lignes sont conservées comme `LEGACY_UNCLASSIFIED`; les lignes `[DÉMO]` restent explicitement `DEMO`.

La fiche `/library/[id]` expose les métadonnées et un aperçu limité. La suppression confirmée utilise un POST et supprime fichier UUID, versions, journal, Source et projection Document. La recherche reste lexicale; il n’existe ni embedding ni RAG dans ce lot.

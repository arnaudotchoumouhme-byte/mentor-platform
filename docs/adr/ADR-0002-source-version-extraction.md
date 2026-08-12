# ADR-0002 — Source, SourceVersion et extraction locale

Statut : accepté pour le LOT 2.

Décision : conserver `documents` comme projection compatible, introduire `Source` pour provenance/identité et `SourceVersion` pour checksum/contenu immuable. PDF.js et Mammoth fonctionnent exclusivement côté serveur et localement.

Conséquence : les futurs chunks pourront référencer `source_version_id`. Le timeout interrompt l’attente mais ne garantit pas l’annulation native immédiate du parseur; une isolation worker est différée.

Rollback : arrêter l’application, restaurer la sauvegarde SQLite contrôlée et le code antérieur, puis conserver les fichiers `documents/` en quarantaine jusqu’à validation humaine.

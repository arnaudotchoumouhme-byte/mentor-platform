# Sécurité de l’import documentaire

## Multipart

La route refuse avant `request.formData()` les requêtes dont le `Content-Length` dépasse 52 Mio, les valeurs invalides et les contenus qui ne déclarent pas un `multipart/form-data` avec boundary. Après matérialisation, elle contrôle aussi la taille réellement reçue, le nombre de fichiers et les champs autorisés.

L’API Web `Request.formData()` de Next.js ne fournit pas de limite de streaming portable dans cette architecture. Quand `Content-Length` est absent ou mensonger, le runtime peut donc commencer à matérialiser le multipart avant le contrôle secondaire. Pour une exposition publique, la même limite doit également être appliquée au reverse proxy ou au pare-feu applicatif en amont.

## DOCX

Le DOCX est analysé en mémoire sans extraction. Le répertoire central ZIP est borné et vérifié : archive mono-disque, entrées non chiffrées, chemins relatifs sûrs, nombre d’entrées, taille décompressée annoncée, ratio par entrée, offsets locaux et composants OpenXML obligatoires.

## Cohérence éventuelle

Le stockage et SQLite ne partagent pas de transaction distribuée. Le protocole utilise donc un journal durable : fichier temporaire synchronisé et fermé, entrée `pending`, promotion atomique sans overwrite, puis transaction SQLite plaçant l’entrée à `ready`. La récupération idempotente finalise les promotions interrompues, nettoie les temporaires et fichiers UUID orphelins après rétention, et marque `missing` un enregistrement dont le fichier final a disparu sans supprimer aveuglément le document métier.

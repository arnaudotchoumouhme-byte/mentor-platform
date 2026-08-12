# Revue pharmacothérapeutique pédagogique

Le moteur structure la revue selon indication, efficacité, sécurité, adhésion/utilisation et monitoring. Il différencie allergie, intolérance, effet indésirable et réaction inconnue. Il détecte directement les duplications de substance du scénario, mais les interactions, contre-indications, règles posologiques et exigences de surveillance doivent provenir de règles reliées à des citations validées.

Une donnée requise absente produit `INSUFFICIENT_DATA`/`MISSING_DATA_SIGNAL`; une règle absente produit `NO_EVIDENCE`. Ces états ne doivent jamais être fusionnés. Une duplication reste `NEEDS_VERIFICATION`, car elle peut être intentionnelle.

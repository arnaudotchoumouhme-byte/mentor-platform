# Sécurité clinique éducative

`ClinicalSafetyEngine` priorise les signaux justifiés : allergie, interaction, contre-indication, duplication, dose, monitoring, donnée manquante et red flag. Une sévérité n'est affichée que lorsqu'elle est fournie par une preuve. Manquer un signal pertinent produit `ERR_SAFE`, suivi de `SAFETY_CHECKLIST → SENTINEL_CASE → PRIORITY_RETEST`.

Les logs ne contiennent pas le cas, les médicaments, les réponses ni les documents complets. Ils contiennent uniquement les identifiants techniques, comptes de signaux, état et durée.

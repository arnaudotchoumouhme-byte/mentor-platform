# PEBC Item Authoring Standard v1

Statut : norme interne candidate - prête à être appliquée aux items en revue, sans prétendre reproduire ni prédire l'examen PEBC.

Version : 1.0.0
Date : 2026-08-20
Portée : Mentor PEBC, Examen d'aptitude - Partie I (QCM)

## 1. Objet et limites

Cette norme définit la création, la revue, la publication et la présentation sécurisée des QCM Mentor PEBC. Elle s'appuie sur la structure publique de l'examen, mais ne copie pas les questions officielles et ne revendique ni affiliation, ni approbation, ni équivalence psychométrique avec le PEBC.

Les exemples officiels servent uniquement à observer le format, la concision et le type de raisonnement. Tout item Mentor doit être rédigé originalement et sourcé indépendamment.

## 2. Référentiel normatif

Sources prioritaires, vérifiées le 2026-08-20 :

- [PEBC - Pharmacist Qualifying Examination Part I Sample Questions, février 2026](https://pebc.ca/wp-content/uploads/pdfs/Sample%20Question%20PDFs/Pharmacist%20Qual%20Exam%20Sample%20Questions%20-%20EN.pdf) : exemples de formulation et de réponses A-D; le PEBC précise que ces exemples ne reproduisent pas exactement la difficulté ou les proportions de l'examen et qu'ils peuvent devenir obsolètes.
- [PEBC - Qualifying Examination Blueprint, applicable dès mai 2026](https://pebc.ca/wp-content/uploads/pdfs/Qual%20EN/New_BP_2026_Pharmacists_EN.pdf) : pondérations et compétences évaluées.
- [PEBC - Examination Design and Style](https://pebc.ca/pharmacists/qualifying-examination/preparing-for-the-examination/part-i/examination-design-and-style/) : meilleure réponse, unités SI, calculatrice et conventions de calcul.
- [PEBC - Linear-on-the-Fly Testing (LOFT)](https://pebc.ca/loft/) et [Candidate Information for Computer-based Exams](https://pebc.ca/wp-content/uploads/pdfs/Common/EN/Candidate_Information_for_Computer-based_Exams_RP.pdf) : assemblage d'examens répondant à des spécifications, sécurité de la banque, questions autonomes et cas; un cas comporte habituellement 2 à 4 questions identifiées séparément.
- [NAPRA - Professional Competencies at Entry to Practice in Canada](https://www.napra.ca/publication/professional-competencies-for-pharmacists-and-pharmacy-technicians-at-entry-to-practice-in-canada/) : connaissances, habiletés, attitudes et jugements requis pour une pratique sûre et éthique, à appliquer dans le contexte des normes et de la juridiction pertinentes.
- [PEBC - References and Learning Resources](https://pebc.ca/pharmacists/qualifying-examination/preparing-for-the-examination/references-and-learning-resources/) : nécessité d'utiliser des références à jour et absence d'endossement d'un manuel ou cours particulier.

Le blueprint 2026 répartit la Partie I entre Clinical Care (50 %), Distribution (20 %), Knowledge and Expertise (11 %), Communication and Collaboration (4 %), Leadership and Stewardship (3 %) et Professionalism (12 %). Ces pondérations guident l'assemblage d'un corpus ou d'un examen; elles ne justifient pas artificiellement la classification d'un item individuel.

## 3. Contrat obligatoire d'un item

Un item publiable doit avoir :

- un `itemId` stable et une `version` entière immuable;
- un `status` éditorial (`DRAFT`, `IN_REVIEW`, `PUBLISHED` ou `RETIRED`);
- un `itemType` (`STANDALONE` ou `CASE`);
- un `cognitiveLevel` parmi les quatre niveaux de la section 6;
- un stem original;
- exactement quatre options ordonnées A, B, C et D;
- une seule meilleure réponse;
- une explication post-réponse et une justification de chaque distracteur;
- une difficulté opérationnelle (`FOUNDATION`, `INTERMEDIATE` ou `ADVANCED`), distincte du niveau cognitif;
- une source versionnée et un localisateur exact;
- un seul mapping primaire vers le blueprint et la compétence NAPRA/PEBC;
- un thème, un objectif d'apprentissage et, si applicable, une juridiction;
- une évaluation de sécurité, d'obsolescence et de préparation à la revue.
- un état `DOCUMENTARY_CLINICAL_VALIDATION` obligatoire;
- un état `EDITORIAL_REVIEW` obligatoire;
- un état `INDEPENDENT_PHARMACIST_REVIEW` facultatif et traçable.

Les valeurs minimales de traçabilité sont :

- `DOCUMENTARY_CLINICAL_VALIDATION` : `PENDING`, `CONFIRMED`, `CONFIRMED_WITH_NUANCE`, `OUTDATED`, `CONTRADICTED` ou `INSUFFICIENT_EVIDENCE`;
- `EDITORIAL_REVIEW` : `PENDING`, `APPROVED` ou `REJECTED`;
- `INDEPENDENT_PHARMACIST_REVIEW` : `NOT_PERFORMED`, `COMPLETED` ou `CHANGES_REQUESTED`;
- `SAFETY_REVIEW` : `PENDING`, `NO_UNRESOLVED_ISSUE` ou `UNRESOLVED_ISSUE`.

Une publication sans revue pharmacien est autorisée seulement si toutes les conditions obligatoires sont remplies et doit conserver explicitement `INDEPENDENT_PHARMACIST_REVIEW: NOT_PERFORMED`. Une revue pharmacien reste recommandée, particulièrement pour les urgences, doses, interactions, contre-indications, populations vulnérables et décisions à conséquence élevée.

Le contrat importable `MCQ_CORPUS/1` actuel ne contient pas encore tous les champs éditoriaux décrits ici (`itemType`, `cognitiveLevel`, justifications individuelles, risque et preuve de revue). Ces métadonnées doivent rester dans le dossier éditorial tant qu'une évolution explicite et testée du contrat d'import ne les prend pas en charge. Elles ne doivent pas être perdues ni compressées artificiellement dans le stem.

## 4. Formats d'item

### 4.1 STANDALONE

L'item fournit tout le contexte nécessaire dans un stem autonome. Il ne dépend d'aucune réponse précédente. Il convient aux connaissances, aux mécanismes, aux calculs courts et aux décisions simples.

### 4.2 CASE

Un cas présente un contexte clinique ou professionnel commun, puis habituellement 2 à 4 items séparés. Chaque item :

- est identifié et noté indépendamment;
- fournit ou référence explicitement les données nécessaires;
- ne révèle pas la réponse d'un autre item;
- ne dépend pas d'une réponse antérieure;
- n'introduit que des données plausibles, minimales, anonymes et sourcées;
- conserve une version du scénario partagé.

Une banque doit permettre un mélange équilibré de questions autonomes et de cas, conformément aux informations publiques sur la Partie I, sans inventer une proportion que le PEBC ne publie pas.

## 5. Rédaction du stem

Le stem doit :

1. poser un seul problème et une seule tâche;
2. contenir toutes les données nécessaires, mais aucune donnée décorative;
3. pouvoir être compris avant la lecture des options;
4. employer des médicaments par leur dénomination générique, sauf objectif justifié;
5. employer les unités SI et une précision adaptée à la décision;
6. utiliser une formulation positive; si une négation est indispensable, mettre visuellement en évidence `NE ... PAS` ou `SAUF`;
7. éviter le trivia, les indices grammaticaux, les absolus injustifiés et les formulations ambiguës;
8. préciser la juridiction et la date de référence lorsqu'une règle varie;
9. ne contenir ni donnée patient réelle, ni stéréotype, ni information non pertinente sur un groupe protégé;
10. rester compatible avec une lecture accessible et une traduction contrôlée.

Le stem ne doit pas demander « toutes les réponses exactes », une combinaison de réponses, ni une vérité générale quand la tâche réelle porte sur la meilleure action.

## 6. Niveaux cognitifs internes

| Niveau | Définition | Preuve attendue dans l'item |
|---|---|---|
| `FOUNDATION` | Connaissance ou compréhension d'un concept indispensable. | Identifier, expliquer ou distinguer un mécanisme sans décision clinique complexe. |
| `APPLICATION` | Application directe d'une règle ou d'un concept à des données explicites. | Utiliser l'information fournie pour produire une conclusion déterministe. |
| `CLINICAL_DECISION` | Choix de la meilleure intervention pharmaceutique parmi plusieurs actions plausibles. | Prioriser sécurité, efficacité, patient et champ de pratique. |
| `TRANSFER` | Nouveau contexte testant la même compétence sans reprendre l'exemple d'apprentissage. | Reconnaître et appliquer le principe dans une situation nouvelle, sans information cachée. |

Le niveau cognitif ne doit pas être gonflé par un long scénario. Un rappel déguisé en cas reste `FOUNDATION`. La difficulté reflète la complexité réelle des données et des distracteurs, pas la longueur du texte.

## 7. Options et distracteurs

Chaque item comporte exactement A, B, C et D. Une seule option est la meilleure réponse selon la source et le contexte.

Les trois distracteurs doivent :

- être plausibles pour un candidat insuffisamment préparé;
- représenter une erreur distincte et diagnostique;
- appartenir à la même catégorie logique et conserver une syntaxe parallèle;
- être mutuellement exclusifs et ne pas se chevaucher avec la réponse;
- avoir une longueur et un degré de précision comparables;
- être faux ou moins appropriés pour une raison démontrable;
- éviter « toutes ces réponses », « aucune de ces réponses », les choix combinés et l'humour;
- ne pas utiliser d'absolu (`toujours`, `jamais`) comme indice, sauf si cet absolu est précisément établi;
- ne pas introduire un risque clinique gratuit ou une donnée non sourcée.

À l'échelle d'un corpus, la position A-D des bonnes réponses est contrôlée afin d'éviter toute séquence ou distribution fournissant un indice. On ne déplace toutefois jamais une clé uniquement pour satisfaire un quota si cela dégrade la lisibilité des options.

Une justification éditoriale distincte explique pourquoi chaque distracteur est incorrect. Elle est réservée à la revue et à l'explication post-réponse; elle n'est jamais livrée avant la soumission.

## 8. Calculs

Un item de calcul doit :

- mesurer un calcul pertinent à la pratique, non une énigme arithmétique;
- présenter les unités et données requises en SI;
- fournir une formule ou une constante lorsque l'examen officiel en fournirait une;
- indiquer la règle d'arrondi si elle influence la réponse;
- utiliser un zéro initial (`0,5`) et éviter un zéro terminal dangereux (`5,0`) dans les doses;
- proposer quatre résultats plausibles construits à partir d'erreurs de calcul identifiables;
- permettre un calcul indépendant, reproductible et vérifié par un second auteur;
- inclure une analyse de plausibilité et de sécurité du résultat.

## 9. Jugement pharmaceutique

Un item de jugement doit demander la meilleure action du pharmacien, pas seulement une connaissance médicale. Le scénario donne les éléments nécessaires pour considérer indication, efficacité, sécurité, adhésion, préférences, interactions, surveillance, communication, urgence et limites du champ de pratique.

La réponse doit être la meilleure prochaine intervention, à ce moment précis. Les distracteurs peuvent être des actions raisonnables mais prématurées, incomplètes ou moins sûres; ils ne doivent pas être absurdes.

## 10. Sécurité clinique et éditoriale

Avant publication :

- toute dose, interaction, contre-indication, urgence et recommandation est corroborée par une source canadienne actuelle et autoritative;
- la validation clinique documentaire est terminée et ne conclut ni `CONTRADICTED`, ni `OUTDATED`, ni `INSUFFICIENT_EVIDENCE`;
- la revue éditoriale est `APPROVED`;
- tout problème de sécurité identifié est résolu et `SAFETY_REVIEW` vaut `NO_UNRESOLVED_ISSUE`;
- une revue indépendante par un pharmacien compétent est recommandée mais facultative; son résultat, y compris `NOT_PERFORMED`, est conservé;
- les variations provinciales sont identifiées;
- les références périssables ont une date de révision obligatoire;
- aucune donnée patient réelle ou ré-identifiable n'est utilisée;
- aucun contenu protégé n'est copié au-delà de ce qui est permis;
- l'item ne prétend pas être une question PEBC réelle ou prédictive;
- un désaccord de source bloque `PUBLISHED` jusqu'à résolution documentée.

## 11. Traçabilité et mapping

Chaque affirmation déterminante doit être traçable vers :

- `sourceVersionId` stable;
- titre, auteur ou institution, édition/version et date;
- empreinte du fichier ou identifiant documentaire interne;
- page exacte et, si disponible, section/table/figure;
- date de consultation et date de prochaine revue;
- statut de la source (`PRIMARY`, `SECONDARY`, `INTERNAL_UNVERIFIED`);
- note d'écart si une validation externe est requise.

Le dossier éditorial conserve également les trois décisions de workflow, leur date et, lorsqu'une revue a eu lieu, l'identifiant non sensible du réviseur :

- `DOCUMENTARY_CLINICAL_VALIDATION` — obligatoire;
- `EDITORIAL_REVIEW` — obligatoire;
- `INDEPENDENT_PHARMACIST_REVIEW` — facultative/recommandée et jamais inférée implicitement.

Le contrat `MCQ_CORPUS/1` et MIG-0014 ne persistent pas encore ces décisions. Jusqu'à une évolution explicite du modèle, le dossier éditorial versionné est la source de traçabilité; aucune valeur ne doit être inventée ou compressée dans les colonnes existantes.

Chaque item reçoit un mapping primaire unique : version du blueprint, domaine, identifiant de compétence, thème et objectif. Des tags secondaires peuvent faciliter la recherche, mais ne changent pas la compétence effectivement mesurée.

Pour 2026, les identifiants PEBC/NAPRA du blueprint doivent être conservés tels quels (par exemple `1.2`, `1.4`, `2.2`). Une mise à jour du blueprint crée une nouvelle version de mapping; elle ne réécrit pas l'historique d'un item déjà tenté.

## 12. Sécurité de la réponse et contrat de présentation

Avant soumission, le client ne reçoit que :

- identifiants opaques nécessaires à la session;
- stem;
- choix A-D;
- position dans la session et métadonnées non révélatrices.

Sont interdits avant soumission : `correctChoiceId`, indicateur de correction, explication, justifications de distracteurs, score attendu, métadonnées ou noms permettant d'inférer la réponse.

La réponse correcte reste côté serveur. Toute opération GET, answer ou complete vérifie l'identité et la propriété de la session. Après une soumission acceptée et enregistrée, l'API peut retourner la correction et l'explication prévues. Le replay historique utilise la version réellement présentée; une nouvelle version ne modifie jamais une tentative passée.

## 13. Explication post-réponse

L'explication doit :

- nommer la bonne réponse et expliquer le raisonnement;
- expliquer brièvement pourquoi chaque distracteur ne convient pas;
- relier la décision à l'objectif et à la compétence;
- rappeler la considération de sécurité pertinente;
- citer la source et le localisateur;
- signaler toute dépendance à une juridiction, une date ou une validation externe;
- rester pédagogique, concise et exempte de faux niveau de certitude.

## 14. Critères `READY_FOR_HUMAN_REVIEW`

`YES` signifie prêt à être examiné par un humain; cela ne signifie ni validé, ni publiable.

Un item est `READY_FOR_HUMAN_REVIEW: YES` seulement si :

- [ ] l'objectif et le mapping primaire sont explicites;
- [ ] le type et le niveau cognitif sont justifiés;
- [ ] le stem est original, autonome et sans ambiguïté connue;
- [ ] il existe exactement quatre options A-D et une seule meilleure réponse;
- [ ] chaque distracteur est plausible et possède une justification;
- [ ] la réponse et les explications sont soutenues par une page/section exacte;
- [ ] le risque clinique, juridique et d'obsolescence est déclaré;
- [ ] aucune donnée réelle, aucun secret et aucun contenu officiel copié n'est présent;
- [ ] la projection pré-soumission ne révèle aucune correction;
- [ ] l'item peut être revu sans information manquante.

Passage à `PUBLISHED` : `DOCUMENTARY_CLINICAL_VALIDATION` et `EDITORIAL_REVIEW` sont obligatoires, de même qu'un contrôle de sécurité sans problème non résolu et un test technique du contrat de projection. La publication est interdite lorsque la validation documentaire vaut `CONTRADICTED`, `OUTDATED` ou `INSUFFICIENT_EVIDENCE`, ou lorsque `SAFETY_REVIEW` vaut `UNRESOLVED_ISSUE`. `INDEPENDENT_PHARMACIST_REVIEW` est facultative mais recommandée et doit toujours être tracée, y compris par `NOT_PERFORMED`. L'auteur ne s'auto-approuve pas pour la revue éditoriale obligatoire.

## 15. Question de revue de simplicité

> Cette solution pourrait-elle être plus simple tout en restant fiable, compréhensible, testable et évolutive ?

Si oui, simplifier l'item ou son dossier éditorial avant la revue. La complexité du scénario n'est jamais un objectif.

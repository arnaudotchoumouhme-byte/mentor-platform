# Rapport — Accueil pédagogique guidé

Date : 13 septembre 2026. Branche locale : `codex/home-guided-next-action`.
Base : `8ac9f5ff83138c63c863971d99d60c6454658e36`.

## Objectif et comportement

L’accueil présente une décision principale, son motif et une destination existante. La structure générale, Mission du jour, parcours PEBC, QCM, ECOS, carte de compétences, Coach et progression sont conservés.

| Avant | Après |
| --- | --- |
| Plusieurs activités concurrentes ; motif pouvant évoquer une faiblesse alors que le bouton ouvre une tâche | Sujet, type, motif et bouton issus de la même recommandation |
| Blocs Série/Badges/XP et états vides répétés | Repères non alimentés dans un volet fermé ; activités terminées affichées une seule fois si présentes |
| Accueil vide descriptif | Bienvenue et une première action réalisable : préparer une session dans le plan d’étude |
| Compétences dans l’ordre reçu | Prioritaire → Fragile → À consolider → Pas encore évalué → Maîtrisé, scores inchangés |
| Académie menant implicitement au planificateur | Description explicite et CTA « Planifier mes prérequis » |
| Liens génériques depuis les compétences | Ancre de la faiblesse active ou du domaine dans la progression |

## Contrat de recommandation

`buildNextBestAction(state, now)` est une projection pure. `buildDailyMission` partage ses candidats et expose la même action et le même motif, sans second moteur.

1. Première faiblesse active dans les données reçues : ouvrir ses observations et son action recommandée.
2. Tâche non terminée du jour local, triée selon sa priorité enregistrée.
3. Flashcards actives arrivées à échéance.
4. QCM disponibles dans l’état existant.
5. Dernier résultat daté valide : consulter cette activité dans la progression.
6. À défaut : choisir un premier objectif dans le plan d’étude.

La confiance d’une faiblesse n’est pas convertie en priorité. La durée n’est affichée que pour une tâche ayant une durée positive finie. La durée passée d’un essai n’est pas une estimation de la prochaine activité. Aucune valeur inconnue n’est inventée. Le mode libre « Choisir moi-même » et le Coach restent secondaires. Les autres éléments de la mission sont accessibles dans un volet fermé.

## Fichiers

- `src/presentation/dashboard/pebc-dashboard.ts` : contrat, sélection partagée, ordre des compétences, libellés PEBC.
- `src/app/page.tsx` : hiérarchie guidée, motif, premier usage, exploration et divulgation progressive.
- `src/app/weaknesses/page.tsx`, `src/app/study-plan/page.tsx`, `src/app/progress/page.tsx` : uniquement ancres natives et marge de défilement.
- `src/presentation/dashboard/pebc-dashboard.test.ts`, `src/presentation/dashboard/pebc-interface.test.ts` : scénarios de priorité, métadonnées, états et non-régression.
- Ce rapport et six captures dans `docs/reports/assets/home-guided/`.

## Vérification visuelle et navigation

Prévisualisation locale avec Playwright et Edge, contexte neuf, `/api/state` intercepté par des fixtures synthétiques. Les autres appels API et les origines externes sont bloqués. Répertoire de données temporaire, MLE et démo désactivés. Aucun accès à une base réelle ni authentification réelle.

| Vue | Dimensions | État vide | État alimenté |
| --- | --- | --- | --- |
| Mobile étroit | 320 × 740 | [Capture](assets/home-guided/mobile-empty.png) | [Capture](assets/home-guided/mobile-loaded.png) |
| Tablette | 768 × 1024 | [Capture](assets/home-guided/tablet-empty.png) | [Capture](assets/home-guided/tablet-loaded.png) |
| Desktop | 1440 × 1000 | [Capture](assets/home-guided/desktop-empty.png) | [Capture](assets/home-guided/desktop-loaded.png) |

Les six scénarios passent : aucune largeur débordante, un H1, destination principale attendue, bouton principal dans la première vue et au-dessus de la navigation mobile. Sur mobile alimenté, son bord inférieur est à 597,75 px. Titres importants multilignes, statuts textuels, motif blanc sur le fond existant. Navigation clavier jusqu’au CTA, contour de focus visible et activation par Entrée vérifiés. Ouverture des volets, lien d’exploration et ancres faiblesse/tâche/domaine vérifiés. Aucune erreur console ou exception de page capturée.

Les captures pleine page proviennent du serveur de développement : elles incluent son indicateur et la navigation mobile fixe existante. Cette barre recouvre la bande inférieure de la fenêtre pendant le défilement ; le CTA reste dégagé et le contenu demeure accessible par défilement. Ceci ne constitue pas un audit WCAG exhaustif ni un test d’authentification connecté.

## Gates

| Contrôle | Résultat |
| --- | --- |
| Tests ciblés | PASS : 29/29, 2 fichiers, 49,65 s |
| Suite complète | PASS : 724 réussis, 1 ignoré, 147 fichiers ; 491,18 s ; code 0 ; aucun timeout |
| Typecheck | PASS : `tsc --noEmit`, code 0 |
| Lint | PASS : `eslint .`, code 0 |
| Build production | PASS : contrôle Node puis `next build`, code 0 ; compilation, TypeScript et génération des routes réussis |
| Diff check final | PASS : `git diff --check`, code 0 |
| Vérification navigateur | PASS : six vues, clavier, ancres, volets, aucune erreur console |

Commande ciblée : `node node_modules/vitest/vitest.mjs run src/presentation/dashboard --maxWorkers=1`.
Commande globale : `node node_modules/vitest/vitest.mjs run --maxWorkers=1`.
Les tests couvrent les six niveaux de priorité, les métadonnées absentes, les éléments inéligibles, le jour local, la conservation des scores, loaded/loaded-empty, loading, réseau/serveur, authentification, refus, quota et conflit. Les attentes historiques sont adaptées au comportement demandé ; aucun test n’est supprimé.

## Limites et dette

- Foundation possède une infrastructure/API, mais pas de page apprenant exploitable identifiée. Le plan d’étude reste la destination temporaire honnête ; un vrai parcours de prérequis relève d’une mission distincte.
- Une faiblesse ouvre l’action existante : aucune session ou configuration Coach n’est automatiquement créée.
- La reprise ouvre un résultat passé ; l’état disponible ne décrit pas une session interrompue à reprendre exactement.
- Série, badges, XP et objectif hebdomadaire n’ont pas de contrat alimenté dans l’état consommé. Le volet les conserve sans produire de chiffres.
- Le tri des faiblesses reste celui de la source existante, sans inventer de classement clinique. Les scores et leurs calculs préexistants sont conservés ; cette présentation n’est pas un moteur de maîtrise ni une preuve de préparation complète au PEBC.
- L’appréciation « compréhensible en quelques secondes » reste à confirmer par une revue humaine et des essais utilisateurs.

## Périmètre protégé et retour arrière

Aucune modification de données, API de mutation, fournisseur IA, flags, schéma ou migration. MIG-0018 et MIG-0019 inchangées. Concepts MLE DRAFT et dix rattachements PROPOSÉS inchangés. Aucun accès Render, push, merge ou déploiement. LOT 10 non commencé.

Le retour arrière consiste à annuler le commit UX local dédié ; aucune migration ni restauration de données n’est nécessaire.

## Résultat final

```text
UX_NEXT_BEST_ACTION = PASS
COGNITIVE_LOAD_REDUCED = PASS
PEBC_PATH_CLARITY = PASS
FIRST_TIME_USER_FLOW = PASS
TARGETED_TESTS = PASS (29/29)
FULL_TESTS = PASS (724 réussis, 1 ignoré)
TYPECHECK = PASS
LINT = PASS
BUILD = PASS
DIFF_CHECK = PASS
REAL_DB_TOUCHED = NON
DEPLOY = NON
LOT_10_STARTED = NON
SAFE_FOR_HUMAN_REVIEW = OUI
```

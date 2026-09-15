# Paramètres — fournisseurs IA et compte

Branche : `codex/settings-provider-session`, base `8bebde2d6b7369d14b3a8ca6c87f94c31f703c4f`.

Le serveur `server-rag.ts` utilise le moteur documentaire local. La configuration OPENAI_API_KEY existe, mais aucun connecteur de génération OpenAI, Gemini ou Anthropic n'est branché. Aucun fournisseur externe n'est activé par cette correction.

Le catalogue public typé `src/presentation/settings/ai-providers.ts` centralise les identifiants, valeurs, libellés et disponibilité. Claude apparaît désactivé avec « à configurer — connecteur non intégré », comme OpenAI et Gemini. L'ajout futur d'un connecteur doit précéder toute activation dans ce catalogue ; les métadonnées ne lisent aucun secret et ne constituent pas un routeur serveur.

`AccountSecurity` utilise `useUser` du SDK Auth0 existant et les liens ordinaires `/auth/login` et `/auth/logout`. Seul le pseudonyme ou nom est affiché, jamais le profil brut, le subject ou une erreur technique. La section reste visible sans données métier, y compris pour un compte non provisionné. Aucun contrôle d'identité serveur n'est modifié.

Fichiers : page et tests Paramètres, composant compte et tests, catalogue public, présent rapport.

Validation :
- Tests ciblés Paramètres, compte et route IA : 17/17 PASS.
- Typecheck : PASS, code 0.
- Lint : PASS, code 0.
- Build officiel : PASS, code 0. Le lanceur pnpm a émis un avertissement de recherche de mise à jour réseau, sans empêcher le build.
- Suite globale unique : `node node_modules/vitest/vitest.mjs run --maxWorkers=1 --reporter=verbose` ; 151 fichiers, 754 réussis, 1 ignoré, 0 échec ; 358,30 s ; aucun timeout.
- Revue React : hooks inconditionnels, lecture de session via SDK/SWR, liens Auth0 sans routage client, contrôles libellés et options désactivées.
- Diff check : PASS.

Aucune DB réelle ouverte, aucune migration, configuration Auth0/Render/Vercel, donnée métier ou contenu MLE modifié. Aucun push ni déploiement. Tests SQLite globaux uniquement sur bases synthétiques. Les flux Auth0 existants restent inchangés ; un test humain sur Preview sera utile pour vérifier la session réelle après autorisation de push. Rollback : retirer le commit UI, sans opération sur la DB.

SAFE_FOR_PREVIEW = OUI

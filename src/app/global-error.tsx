"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="fr"><body><main className="p-8"><h1>Application indisponible</h1><p>Une erreur critique empêche l’affichage.</p>{error.digest&&<p>Référence support : <code>{error.digest}</code></p>}<button onClick={reset}>Réessayer</button></main></body></html>;
}

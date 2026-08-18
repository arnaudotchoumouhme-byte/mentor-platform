"use client";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="card mx-auto max-w-xl p-6"><h2>Cette zone est indisponible</h2><p>Une erreur inattendue a été isolée. Réessayez l’opération.</p>{error.digest&&<p className="text-xs text-[var(--muted-foreground)]">Référence support : <code>{error.digest}</code></p>}<button className="btn btn-primary" onClick={reset}>Réessayer</button></div>;
}

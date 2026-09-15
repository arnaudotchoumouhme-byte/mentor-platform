"use client";

import { useUser } from "@auth0/nextjs-auth0";

export function AccountSecurity() {
  const { user, isLoading, error } = useUser();
  // Only display a friendly name, never the raw profile, subject or credentials.
  const name = typeof user?.nickname === "string" ? user.nickname : typeof user?.name === "string" ? user.name : undefined;
  return <section className="card mb-6 p-6" aria-label="Compte et sécurité">
    <h2 className="mt-0">Compte et sécurité</h2>
    {isLoading ? <p>Vérification de la session…</p> : user ? <>
      <p>Connecté{name ? ` · ${name}` : ""}</p>
      <a className="btn btn-secondary" href="/auth/logout">Se déconnecter</a>
    </> : <>
      <p>{error ? "Session non confirmée. Connectez-vous pour continuer." : "Non connecté"}</p>
      <a className="btn btn-primary" href="/auth/login">Se connecter</a>
    </>}
  </section>;
}

import { createCatalogGet } from "./catalog-handler";
import { mleCatalogEnabled } from "@/infrastructure/mle/catalog-feature";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = createCatalogGet(
  () => mleCatalogEnabled(process.env),
  async () => {
    const { auth0 } = await import("@/infrastructure/pilot/auth0");
    const { config } = await import("@/infrastructure/config/server-config");
    const { AppError } = await import("@/shared/errors/app-error");
    const session = await auth0.getSession();
    if (!session?.user.sub || !config.pilot.provisionerSubjects.includes(session.user.sub)) throw new AppError({ code: "PILOT_ACCESS_DENIED", userMessage: "Accès éditorial refusé.", category: "security" });
  },
  async () => {
    const { sqliteExecutor } = await import("@/infrastructure/database/sqlite/server-sqlite-executor");
    const { SqliteCatalogRepository } = await import("@/infrastructure/mle/sqlite-catalog-repository");
    const { ReadCatalog } = await import("@/application/mle/catalog-use-cases");
    return new ReadCatalog(new SqliteCatalogRepository(sqliteExecutor));
  },
);

/** Read at request time. Never set by a client or enabled by default. */
export const mleCatalogEnabled = (env: Readonly<Record<string, string | undefined>>) => env.MENTOR_MLE_CATALOG_ENABLED === "1";

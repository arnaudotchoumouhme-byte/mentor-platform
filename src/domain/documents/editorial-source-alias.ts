export const EDITORIAL_SOURCE_ALIAS_PATTERN = /^[A-Z0-9][A-Z0-9-]{1,99}\/V[1-9][0-9]*$/;

export class EditorialSourceAliasError extends Error {
  readonly code = "SOURCE_EDITORIAL_ALIAS_INVALID";

  constructor() {
    super("Editorial source alias must use the canonical NAME/V<number> format.");
    this.name = "EditorialSourceAliasError";
  }
}

declare const editorialSourceAliasBrand: unique symbol;
export type EditorialSourceAlias = string & { readonly [editorialSourceAliasBrand]: true };

export function parseEditorialSourceAlias(value: string): EditorialSourceAlias {
  if (!EDITORIAL_SOURCE_ALIAS_PATTERN.test(value)) throw new EditorialSourceAliasError();
  return value as EditorialSourceAlias;
}

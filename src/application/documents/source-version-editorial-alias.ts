import type { UseCase } from "@/application/contracts";
import { EditorialSourceAliasError, parseEditorialSourceAlias } from "@/domain/documents/editorial-source-alias";
import { AppError } from "@/shared/errors/app-error";
import type {
  AssociateSourceVersionEditorialAliasPersistenceResult,
  SourceVersionEditorialAliasPort,
  SourceVersionEditorialAliasRecord,
} from "./source-version-editorial-alias-port";

export interface EditorialAliasIdGeneratorPort { generate(): string }
export interface EditorialAliasClockPort { now(): string }

export type AssociateSourceVersionEditorialAliasInput = Readonly<{
  editorialAlias: string;
  sourceVersionId: string;
  actorId: string;
  traceId: string;
}>;

export class AssociateSourceVersionEditorialAlias implements UseCase<AssociateSourceVersionEditorialAliasInput, AssociateSourceVersionEditorialAliasPersistenceResult> {
  constructor(
    private readonly repository: SourceVersionEditorialAliasPort,
    private readonly ids: EditorialAliasIdGeneratorPort,
    private readonly clock: EditorialAliasClockPort,
  ) {}

  async execute(input: AssociateSourceVersionEditorialAliasInput): Promise<AssociateSourceVersionEditorialAliasPersistenceResult> {
    let editorialAlias;
    try {
      editorialAlias = parseEditorialSourceAlias(input.editorialAlias);
    } catch (cause) {
      if (cause instanceof EditorialSourceAliasError) {
        throw new AppError({ code: cause.code, userMessage: "L’alias éditorial n’est pas valide.", category: "validation", cause });
      }
      throw cause;
    }
    if (!input.sourceVersionId || !input.actorId || !input.traceId) {
      throw new AppError({ code: "SOURCE_EDITORIAL_ALIAS_INPUT_INVALID", userMessage: "Les paramètres d’association sont incomplets.", category: "validation" });
    }
    return this.repository.associate(Object.freeze({
      aliasId: this.ids.generate(),
      editorialAlias,
      sourceVersionId: input.sourceVersionId,
      createdAt: this.clock.now(),
      actorId: input.actorId,
      traceId: input.traceId,
      provenance: "MANUAL_EDITORIAL_ASSOCIATION",
    }));
  }
}

export class ResolveSourceVersionEditorialAlias implements UseCase<Readonly<{ editorialAlias: string }>, SourceVersionEditorialAliasRecord> {
  constructor(private readonly repository: SourceVersionEditorialAliasPort) {}

  async execute(input: Readonly<{ editorialAlias: string }>): Promise<SourceVersionEditorialAliasRecord> {
    let alias;
    try {
      alias = parseEditorialSourceAlias(input.editorialAlias);
    } catch (cause) {
      if (cause instanceof EditorialSourceAliasError) {
        throw new AppError({ code: cause.code, userMessage: "L’alias éditorial n’est pas valide.", category: "validation", cause });
      }
      throw cause;
    }
    const association = await this.repository.resolve(alias);
    if (!association) throw new AppError({ code: "SOURCE_EDITORIAL_ALIAS_NOT_FOUND", userMessage: "L’alias éditorial est introuvable.", category: "validation" });
    return association;
  }
}

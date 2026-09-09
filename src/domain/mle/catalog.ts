import { z } from "zod";

const id = z.string().trim().min(1).max(160);
const instant = z.string().datetime();
export const prioritySchema = z.enum(["CORE", "HIGH-YIELD", "SECONDARY", "ADVANCED"]);
export const resourceKindSchema = z.enum(["LEARNING_OBJECTIVE", "CHAPTER", "SOURCE", "QUESTION", "CASE", "FLASHCARD"]);
export type ResourceKind = z.infer<typeof resourceKindSchema>;
export const resourceLinkSchema = z.object({
  kind: resourceKindSchema,
  label: z.string().trim().min(1).max(300),
  targetId: id.nullable(),
  targetVersion: id.nullable(),
  provenance: z.string().trim().min(1).max(500),
}).strict().refine(link => (link.targetId === null) === (link.targetVersion === null), "Reference ID and version must be supplied together");
export type ResourceLink = z.infer<typeof resourceLinkSchema>;

export const conceptSchema = z.object({
  conceptId: z.string().uuid(),
  version: z.number().int().positive(),
  title: z.string().trim().min(1).max(300),
  priority: prioritySchema,
  blueprintId: id,
  competencyCodes: z.array(id).min(1),
  resources: z.array(resourceLinkSchema),
  status: z.enum(["DRAFT", "PUBLISHED", "RETIRED"]),
  provenance: z.string().trim().min(1).max(500),
  createdAt: instant,
  authorId: id,
  reviewedAt: instant.nullable(),
  reviewerId: id.nullable(),
}).strict().superRefine((value, context) => {
  if (new Set(value.competencyCodes).size !== value.competencyCodes.length) context.addIssue({ code: "custom", message: "Duplicate competency" });
  if (value.status !== "DRAFT" && (!value.reviewedAt || !value.reviewerId)) context.addIssue({ code: "custom", message: "Editorial review required" });
  if (value.reviewedAt && Date.parse(value.reviewedAt) < Date.parse(value.createdAt)) context.addIssue({ code: "custom", message: "Review predates creation" });
  if (Boolean(value.reviewedAt) !== Boolean(value.reviewerId)) context.addIssue({ code: "custom", message: "Incomplete review provenance" });
  const keys = value.resources.map(link => `${link.kind}:${link.targetId ?? link.label}:${link.targetVersion ?? "pending"}`);
  if (new Set(keys).size !== keys.length) context.addIssue({ code: "custom", message: "Duplicate resource link" });
});
export type ConceptVersion = z.infer<typeof conceptSchema>;
export type ConceptRef = Readonly<{ conceptId: string; version: number }>;
export const dependencySchema = z.object({
  fromId: z.string().uuid(), fromVersion: z.number().int().positive(),
  toId: z.string().uuid(), toVersion: z.number().int().positive(),
  relation: z.enum(["PREREQUISITE_OF", "EXPLAINS", "RELATED_TO"]),
  provenance: z.string().trim().min(1).max(500), createdAt: instant,
}).strict();
export type ConceptDependency = z.infer<typeof dependencySchema>;
export type Blueprint = Readonly<{
  id: string; version: string; effectiveFrom: string; sourceUrl: string;
  categories: readonly Readonly<{ code: string; label: string; total: number; mcq: number; osce: number; competencies: readonly string[] }>[];
}>;
export type Catalog = Readonly<{ blueprint: Blueprint; concepts: readonly ConceptVersion[]; dependencies: readonly ConceptDependency[] }>;
export const conceptKey = (value: ConceptRef) => `${value.conceptId}@${value.version}`;

export function validateCatalog(catalog: Catalog): Catalog {
  z.object({ id, version: id, effectiveFrom: z.iso.date(), sourceUrl: z.url().refine(value => value.startsWith("https://")) }).parse(catalog.blueprint);
  const nodes = new Set<string>();
  const codes = new Set(catalog.blueprint.categories.flatMap(category => category.competencies));
  for (const category of catalog.blueprint.categories) {
    if (!category.code || !category.label || !category.competencies.length) throw new Error("Invalid blueprint category");
    for (const weight of [category.total, category.mcq, category.osce]) if (!Number.isFinite(weight) || weight < 0 || weight > 100) throw new Error("Invalid blueprint weight");
  }
  if (new Set(catalog.blueprint.categories.map(category => category.code)).size !== catalog.blueprint.categories.length || codes.size !== catalog.blueprint.categories.flatMap(category => category.competencies).length) throw new Error("Duplicate blueprint reference");
  for (const modality of ["total", "mcq", "osce"] as const) if (Math.abs(catalog.blueprint.categories.reduce((sum, category) => sum + category[modality], 0) - 100) > 0.001) throw new Error("Blueprint weights must total 100");
  for (const candidate of catalog.concepts) {
    const concept = conceptSchema.parse(candidate);
    const key = conceptKey(concept);
    if (nodes.has(key)) throw new Error("Duplicate concept version");
    nodes.add(key);
    if (concept.blueprintId !== catalog.blueprint.id || concept.competencyCodes.some(code => !codes.has(code))) throw new Error("Unknown official competency");
  }
  const adjacency = new Map<string, string[]>();
  const edgeKeys = new Set<string>();
  for (const candidate of catalog.dependencies) {
    const edge = dependencySchema.parse(candidate);
    const from = `${edge.fromId}@${edge.fromVersion}`;
    const to = `${edge.toId}@${edge.toVersion}`;
    if (!nodes.has(from) || !nodes.has(to) || edge.fromId === edge.toId) throw new Error("Invalid concept dependency");
    const key = `${from}:${to}:${edge.relation}`;
    if (edgeKeys.has(key)) throw new Error("Duplicate dependency");
    edgeKeys.add(key);
    if (edge.relation === "PREREQUISITE_OF") adjacency.set(from, [...(adjacency.get(from) ?? []), to]);
  }
  const visiting = new Set<string>(); const done = new Set<string>();
  function visit(node: string) {
    if (visiting.has(node)) throw new Error("Cyclic prerequisites");
    if (done.has(node)) return;
    visiting.add(node);
    for (const target of adjacency.get(node) ?? []) visit(target);
    visiting.delete(node); done.add(node);
  }
  for (const node of nodes) visit(node);
  return catalog;
}

/** Editorial coverage only. Never a learner score or a count of mastered objectives. */
export function catalogCoverage(catalog: Catalog) {
  const latest = new Map<string, ConceptVersion>();
  for (const concept of catalog.concepts) if (!latest.has(concept.conceptId) || latest.get(concept.conceptId)!.version < concept.version) latest.set(concept.conceptId, concept);
  const concepts = [...latest.values()].filter(concept => concept.status !== "RETIRED");
  return catalog.blueprint.categories.flatMap(category => category.competencies.map(code => ({
    categoryCode: category.code, competencyCode: code, required: true as const,
    mappedConcepts: concepts.filter(concept => concept.competencyCodes.includes(code)).length,
    publishedConcepts: concepts.filter(concept => concept.status === "PUBLISHED" && concept.competencyCodes.includes(code)).length,
  })));
}

export function assertPublicationReady(concept: ConceptVersion, resolved: readonly ResourceLink[]): void {
  conceptSchema.parse(concept);
  if (!concept.reviewerId || !concept.reviewedAt) throw new Error("Editorial approval required");
  for (const kind of ["LEARNING_OBJECTIVE", "CHAPTER", "SOURCE"] as const) if (!concept.resources.some(link => link.kind === kind)) throw new Error(`Missing ${kind}`);
  if (concept.resources.some(link => !link.targetId || !resolved.some(candidate => candidate.kind === link.kind && candidate.targetId === link.targetId && candidate.targetVersion === link.targetVersion))) throw new Error("Unresolved or unapproved native resource");
}

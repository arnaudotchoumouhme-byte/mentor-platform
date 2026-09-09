import type { Blueprint, Catalog, ConceptVersion, ResourceKind } from "@/domain/mle/catalog";
import { validateCatalog } from "@/domain/mle/catalog";

export const PEBC_2026: Blueprint = {
  id: "PEBC-QUAL-03-2026", version: "03-2026", effectiveFrom: "2026-05-01",
  sourceUrl: "https://pebc.ca/wp-content/uploads/pdfs/Qual%20EN/Pharmacist_Qualifying_Exam_Blueprint.pdf",
  categories: [
    { code: "1A", label: "Providing Care: Clinical Care", total: 45, mcq: 50, osce: 40, competencies: ["1.1", "1.2", "1.3", "1.4", "1.5"] },
    { code: "1B", label: "Providing Care: Distribution", total: 14, mcq: 20, osce: 8, competencies: ["1.6", "1.7", "1.8", "1.9", "1.10"] },
    { code: "2", label: "Knowledge and Expertise", total: 9, mcq: 11, osce: 7, competencies: ["2.2"] },
    { code: "3", label: "Communication and Collaboration", total: 16, mcq: 4, osce: 28, competencies: ["3.1", "3.2", "3.3", "3.4"] },
    { code: "4", label: "Leadership and Stewardship", total: 3, mcq: 3, osce: 3, competencies: ["4.2"] },
    { code: "5", label: "Professionalism", total: 13, mcq: 12, osce: 14, competencies: ["5.1", "5.2", "5.4", "5.5"] },
  ],
};
export const PILOT_CHAPTER = "Épilepsie — principes de traitement et sécurité des antiépileptiques";
const createdAt = "2026-09-08T00:00:00.000Z";
const provenance = "LOT-9/MLE-01: proposition pédagogique, validation clinique et rattachement natif requis";
const definitions: readonly [string, string, ConceptVersion["priority"], readonly string[]][] = [
  ["90000000-0000-4000-8000-000000000001", "Neurotransmission : prérequis du raisonnement", "CORE", ["2.2"]],
  ["90000000-0000-4000-8000-000000000002", "Mécanismes des antiépileptiques : liens à expliquer", "CORE", ["2.2"]],
  ["90000000-0000-4000-8000-000000000003", "Évaluation : recueillir les données pertinentes", "CORE", ["1.1", "1.2"]],
  ["90000000-0000-4000-8000-000000000004", "Principes de choix et de suivi du traitement", "HIGH-YIELD", ["1.3", "1.5"]],
  ["90000000-0000-4000-8000-000000000005", "Sécurité : modification du traitement et conseil", "CORE", ["3.1", "5.5"]],
  ["90000000-0000-4000-8000-000000000006", "Concomitants : analyse des risques à vérifier", "SECONDARY", ["1.2", "5.5"]],
  ["90000000-0000-4000-8000-000000000007", "Contextes particuliers : limites et données manquantes", "ADVANCED", ["1.2", "2.2"]],
];
export const pilotConceptId = (position: number) => `90000000-0000-4000-8000-${String(position + 1).padStart(12, "0")}`;
/** No clinical answers, native IDs or publication approval are fabricated. */
export function createPilotCatalog(): Catalog {
  const concepts = definitions.map(([conceptId, title, priority, codes]): ConceptVersion => ({
    conceptId, version: 1, title, priority, blueprintId: PEBC_2026.id,
    competencyCodes: [...codes], status: "DRAFT", provenance, createdAt, authorId: "LOT-9-MLE-01",
    reviewedAt: null, reviewerId: null,
    resources: (["CHAPTER", "LEARNING_OBJECTIVE", "SOURCE", "QUESTION", "CASE", "FLASHCARD"] as ResourceKind[]).map(kind => ({
      kind, targetId: null, targetVersion: null, provenance,
      label: kind === "CHAPTER" ? PILOT_CHAPTER : kind === "QUESTION" && conceptId === pilotConceptId(4) ? "Candidat éditorial SNC-V4-009, version native à vérifier" : `${kind} à rattacher : ${title}`,
    })),
  }));
  return validateCatalog({ blueprint: PEBC_2026, concepts,
    dependencies: [[0, 1], [1, 3], [2, 3], [2, 4], [3, 6]].map(([from, to]) => ({
      fromId: pilotConceptId(from!), fromVersion: 1, toId: pilotConceptId(to!), toVersion: 1,
      relation: "PREREQUISITE_OF", provenance, createdAt,
    })),
  });
}

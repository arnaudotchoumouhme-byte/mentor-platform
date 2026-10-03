import type { McqRepository } from "./mcq-ports";

export class ListMcqBlueprints {
  constructor(private readonly repository: McqRepository) {}
  execute(learnerId?: string, documentId?: number) { return this.repository.listPublishedBlueprints(learnerId, documentId); }
}

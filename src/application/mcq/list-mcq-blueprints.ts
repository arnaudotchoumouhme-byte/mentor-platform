import type { McqRepository } from "./mcq-ports";

export class ListMcqBlueprints {
  constructor(private readonly repository: McqRepository) {}
  execute() { return this.repository.listPublishedBlueprints(); }
}

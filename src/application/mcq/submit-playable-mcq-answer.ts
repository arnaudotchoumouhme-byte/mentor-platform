import type { SubmitMcqAnswer, SubmitMcqAnswerInput } from "./submit-mcq-answer";
import type { GetPlayableMcqSession } from "./playable-mcq-session";

export class SubmitPlayableMcqAnswer {
  constructor(private readonly submit: SubmitMcqAnswer, private readonly get: GetPlayableMcqSession) {}
  async execute(input: SubmitMcqAnswerInput) {
    await this.submit.execute(input);
    return this.get.execute(input.sessionId);
  }
}

import type { UseCase } from "@/application/contracts";
import { nextInterval } from "@/domain/flashcards/scheduling";
import { AppError } from "@/shared/errors/app-error";

export type MentorAction =
  | Readonly<{ action: "archiveDocument"; id: number; archived: boolean }>
  | Readonly<{ action: "deleteDocument"; id: number }>
  | Readonly<{
      action: "reviewCard";
      id: number;
      rating: string;
      interval: number;
    }>
  | Readonly<{ action: "completeTask"; id: number; completed: boolean }>
  | Readonly<{ action: "resolveWeakness"; id: number }>
  | Readonly<{
      action: "saveAttempt";
      module: string;
      subject: string;
      score: number;
      minutes: number;
    }>
  | Readonly<{
      action: "addFlashcard";
      front: string;
      back: string;
      subject: string;
    }>
  | Readonly<{
      action: "addTask";
      title: string;
      subject: string;
      date: string;
      minutes: number;
    }>
  | Readonly<{
      action: "saveSettings";
      settings: Readonly<Record<string, string>>;
    }>;

export interface DocumentActionsPort {
  setDocumentArchived(id: number, archived: boolean): Promise<boolean>;
  deleteDocument(id: number): Promise<boolean>;
}

export interface LearningActionsPort {
  scheduleCardReview(id: number, intervalDays: number): Promise<boolean>;
  setTaskCompleted(id: number, completed: boolean): Promise<boolean>;
  resolveWeakness(id: number): Promise<boolean>;
  saveAttempt(input: {
    module: string;
    subject: string;
    score: number;
    minutes: number;
  }): Promise<void>;
}

export interface PlanningActionsPort {
  addFlashcard(input: {
    front: string;
    back: string;
    subject: string;
  }): Promise<void>;
  addTask(input: {
    title: string;
    subject: string;
    date: string;
    minutes: number;
  }): Promise<void>;
}

export interface SettingsActionsPort {
  saveSettings(settings: Readonly<Record<string, string>>): Promise<void>;
}

export type MentorActionCapabilities = DocumentActionsPort &
  LearningActionsPort &
  PlanningActionsPort &
  SettingsActionsPort;

function assertResourceFound(found: boolean): void {
  if (!found) {
    throw new AppError({
      code: "NOT_FOUND",
      userMessage: "Ressource introuvable.",
      internalMessage: "The requested action target does not exist.",
    });
  }
}

export class MentorActionsService implements UseCase<MentorAction, void> {
  constructor(private readonly capabilities: MentorActionCapabilities) {}

  async execute(input: MentorAction): Promise<void> {
    switch (input.action) {
      case "archiveDocument":
        return assertResourceFound(
          await this.capabilities.setDocumentArchived(input.id, input.archived),
        );
      case "deleteDocument":
        return assertResourceFound(
          await this.capabilities.deleteDocument(input.id),
        );
      case "reviewCard":
        return assertResourceFound(
          await this.capabilities.scheduleCardReview(
            input.id,
            nextInterval(input.rating, input.interval),
          ),
        );
      case "completeTask":
        return assertResourceFound(
          await this.capabilities.setTaskCompleted(input.id, input.completed),
        );
      case "resolveWeakness":
        return assertResourceFound(
          await this.capabilities.resolveWeakness(input.id),
        );
      case "saveAttempt":
        return this.capabilities.saveAttempt(input);
      case "addFlashcard":
        return this.capabilities.addFlashcard(input);
      case "addTask":
        return this.capabilities.addTask(input);
      case "saveSettings":
        return this.capabilities.saveSettings(input.settings);
    }
  }
}

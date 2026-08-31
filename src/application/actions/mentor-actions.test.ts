import { describe, expect, it, vi } from "vitest";
import {
  MentorActionsService,
  type MentorActionCapabilities,
} from "./mentor-actions";

function createPort(): MentorActionCapabilities {
  return {
    setDocumentArchived: vi.fn(async () => true),
    deleteDocument: vi.fn(async () => true),
    scheduleCardReview: vi.fn(async () => true),
    setTaskCompleted: vi.fn(async () => true),
    resolveWeakness: vi.fn(async () => true),
    saveAttempt: vi.fn(),
    addFlashcard: vi.fn(),
    addTask: vi.fn(),
    saveSettings: vi.fn(),
  };
}

describe("MentorActionsService", () => {
  it("delegates document archiving to its business port", async () => {
    const port = createPort();
    const service = new MentorActionsService(port);

    await service.execute({ action: "archiveDocument", id: 7, archived: true }, "learner-a");

    expect(port.setDocumentArchived).toHaveBeenCalledWith(7, true, "learner-a");
  });

  it("calculates a review interval before persistence", async () => {
    const port = createPort();
    const service = new MentorActionsService(port);

    await service.execute({
      action: "reviewCard",
      id: 3,
      rating: "Facile",
      interval: 4,
    }, "learner-a");

    expect(port.scheduleCardReview).toHaveBeenCalledWith(3, 8, "learner-a");
  });

  it("passes settings without exposing persistence details", async () => {
    const port = createPort();
    const service = new MentorActionsService(port);
    const settings = { language: "fr" };

    await service.execute({ action: "saveSettings", settings }, "learner-a");

    expect(port.saveSettings).toHaveBeenCalledWith(settings, "learner-a");
  });

  it("delegates every remaining action to the matching capability", async () => {
    const port = createPort();
    const service = new MentorActionsService(port);

    await service.execute({ action: "deleteDocument", id: 2 }, "learner-a");
    await service.execute({ action: "completeTask", id: 3, completed: true }, "learner-a");
    await service.execute({ action: "resolveWeakness", id: 4 }, "learner-a");
    await service.execute({
      action: "saveAttempt",
      module: "QCM",
      subject: "Pharmacologie",
      score: 75,
      minutes: 20,
    }, "learner-a");
    await service.execute({
      action: "addFlashcard",
      front: "Question",
      back: "Réponse",
      subject: "Pharmacologie",
    }, "learner-a");
    await service.execute({
      action: "addTask",
      title: "Réviser",
      subject: "Pharmacologie",
      date: "2026-08-07",
      minutes: 30,
    }, "learner-a");

    expect(port.deleteDocument).toHaveBeenCalledWith(2, "learner-a");
    expect(port.setTaskCompleted).toHaveBeenCalledWith(3, true, "learner-a");
    expect(port.resolveWeakness).toHaveBeenCalledWith(4, "learner-a");
    expect(port.saveAttempt).toHaveBeenCalledWith({
      action: "saveAttempt",
      module: "QCM",
      subject: "Pharmacologie",
      score: 75,
      minutes: 20,
    }, "learner-a");
    expect(port.addFlashcard).toHaveBeenCalledWith({
      action: "addFlashcard",
      front: "Question",
      back: "Réponse",
      subject: "Pharmacologie",
    }, "learner-a");
    expect(port.addTask).toHaveBeenCalledWith({
      action: "addTask",
      title: "Réviser",
      subject: "Pharmacologie",
      date: "2026-08-07",
      minutes: 30,
    }, "learner-a");
  });

  it("raises a stable not-found error when a target does not exist", async () => {
    const port = createPort();
    vi.mocked(port.deleteDocument).mockResolvedValue(false);
    const service = new MentorActionsService(port);

    await expect(
      service.execute({ action: "deleteDocument", id: 404 }, "learner-a"),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      userMessage: "Ressource introuvable.",
    });
  });
});

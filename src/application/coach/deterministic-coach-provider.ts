import type { CoachProvider, CoachStep } from "./coach-ports";

const questions = {
  PROFESSOR: "Expliquez ce principe avec vos propres mots.", CLINICAL_PHARMACIST: "Quelles données et quels risques médicamenteux prioriseriez-vous ?", SOCRATIC: "Quelle donnée du cas orienterait votre prochaine vérification ?", TEACH_BACK: "Pourquoi ce point est-il important et que surveilleriez-vous ?", RAPID_REVIEW: "Quel est le point essentiel à retenir ?",
} as const;
const hints = ["", "Commencez par structurer indication, efficacité, sécurité, adhésion et monitoring.", "Relisez les données patient pertinentes et celles qui manquent.", "Vérifiez explicitement allergies, interactions, dose, contre-indications et surveillance.", "La correction doit relier donnée, problème, preuve, décision pédagogique et monitoring."];

export class DeterministicCoachProvider implements CoachProvider {
  generateStep(input: Parameters<CoachProvider["generateStep"]>[0]): CoachStep {
    const evidenceMessage = input.evidenceStatus === "CONFLICT"
      ? "Les sources documentaires disponibles sont contradictoires; aucune conclusion clinique ne peut être affirmée."
      : input.evidenceStatus === "INSUFFICIENT"
        ? "Je n’ai pas suffisamment de preuves documentaires pour confirmer ce point."
        : null;
    return { stepType: input.step, message: evidenceMessage ?? (input.hintLevel ? hints[input.hintLevel] : `Objectif : ${input.objective}`), question: questions[input.mode], hintLevel: input.hintLevel, evidenceRefs: input.evidenceRefs, safetySignals: input.safetySignals, expectedLearnerAction: "Réponse structurée, courte et justifiée." };
  }
}

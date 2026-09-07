import { McqSessionRunner } from "@/components/mcq-session-runner";
import { PageHeader } from "@/components/ui";

export default function MockExams() {
  return <div className="mx-auto max-w-4xl">
    <PageHeader eyebrow="FEAT-023 · Conditions d’examen" title="Examen blanc" description="Une session chronométrée dont les réponses sont conservées et intégrées à votre progression."/>
    <McqSessionRunner sessionKind="MOCK_EXAM" />
  </div>;
}

type FeedbackAnswer = Readonly<{
  choiceId: string;
  correct?: boolean;
  correctChoiceId?: string;
  explanation?: string;
  provenance?: string | null;
}>;

// Optional editorial sections live in the existing explanation text. No clinical
// content is generated: legacy prose and unrecognised headings remain visible.
const headings = [
  "Pourquoi cette réponse est correcte",
  "Mécanisme / concept à comprendre",
  "Pourquoi les autres options sont fausses",
  "Raisonnement du pharmacien",
  "Point PEBC à retenir",
  "Piège classique",
  "Application clinique",
  "Source",
] as const;

function sections(explanation: string) {
  const result: { title: string; text: string }[] = [];
  let current = { title: headings[0] as string, text: "" };
  for (const line of explanation.split(/\r?\n/)) {
    const title = line.replace(/^#{1,3}\s+/, "").replace(/:\s*$/, "").trim();
    const option = title.match(/^([A-D])\s*[—–-]\s*(VRAI|FAUX)$/i);
    const known = option ? `${option[1].toUpperCase()} — ${option[2].toUpperCase()}` : headings.find(heading => heading.toLocaleLowerCase("fr") === title.toLocaleLowerCase("fr"));
    if (known) {
      if (current.text.trim()) result.push(current);
      current = { title: known, text: "" };
    } else current.text += `${line}\n`;
  }
  if (current.text.trim()) result.push(current);
  return result;
}

export function McqAnswerFeedback({ answer, choices }: Readonly<{
  answer: FeedbackAnswer;
  choices: readonly Readonly<{ id: string; text: string }>[];
}>) {
  const label = (id: string) => `${id.toUpperCase()}. ${choices.find(choice => choice.id === id)?.text ?? id}`;
  return <div className="space-y-4">
    <strong>{answer.correct === true ? "Bonne réponse." : answer.correct === false ? "À revoir." : "Correction"}</strong>
    {answer.correct === false && <p>Votre réponse : {label(answer.choiceId)}</p>}
    {answer.correctChoiceId && <p className="font-semibold">Bonne réponse : {label(answer.correctChoiceId)}</p>}
    {answer.explanation?.trim() ? sections(answer.explanation).map((section, index) => <section key={index}>
      <h4 className="font-semibold">{section.title}</h4>
      <p className="whitespace-pre-wrap text-sm leading-7">{section.text.trim()}</p>
    </section>) : <p>Aucune correction disponible pour cette réponse.</p>}
    {answer.provenance && <section><h4 className="font-semibold">Provenance enregistrée</h4><p className="break-words text-sm">{answer.provenance}</p></section>}
  </div>;
}

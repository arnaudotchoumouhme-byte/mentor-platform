import { McqSessionHistory } from "@/components/mcq-session-history";

export default async function HistoricalSession({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <McqSessionHistory key={sessionId} sessionId={sessionId} />;
}

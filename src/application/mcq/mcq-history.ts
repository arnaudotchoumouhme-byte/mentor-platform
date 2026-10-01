export type McqHistoricalError = Readonly<{
  sessionId: string;
  itemId: string;
  itemVersion: number;
  position: number;
  answeredAt: string;
  question: string;
  chosenAnswer: string;
  correctAnswer: string;
  topic: string;
}>;

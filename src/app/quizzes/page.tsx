"use client";
import { QuizRunner } from "@/components/quiz-runner";import { Loading,PageHeader } from "@/components/ui";import { useAppState } from "@/hooks/use-state";
export default function Quizzes(){const {data,act}=useAppState();if(!data)return <Loading/>;return <div className="mx-auto max-w-4xl"><PageHeader eyebrow="FEAT-017 · Entraînement" title="QCM" description="Testez vos connaissances avec une correction immédiate, des distracteurs expliqués et des sources visibles."/><QuizRunner data={data} act={act}/></div>}

import { CourseTrainingPanel } from "@/components/course-training-panel";

export default async function CourseTrainingPage({ params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  return <CourseTrainingPanel documentId={Number(documentId)} />;
}

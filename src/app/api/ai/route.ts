import { NextResponse } from "next/server";
import { z } from "zod";
import {
  AskAiTeacher,
  type AskAiTeacherInput,
  type AskAiTeacherOutput,
} from "@/application/ai/ask-ai-teacher";
import type { UseCase } from "@/application/contracts";
import { SqliteDocumentKnowledge } from "@/infrastructure/database/sqlite/sqlite-document-knowledge";
import { sqliteExecutor } from "@/infrastructure/database/sqlite/server-sqlite-executor";
import { mapErrorToHttp } from "@/presentation/api/http-error-mapper";
import { AppError } from "@/shared/errors/app-error";

const schema = z.object({ question: z.string().trim().min(3), mode: z.string().default("Explication") });
const askAiTeacher = new AskAiTeacher(new SqliteDocumentKnowledge(sqliteExecutor));

function validationFailure() {
  return mapErrorToHttp(
    new AppError({
      code: "VALIDATION_ERROR",
      userMessage: "La question doit être précisée.",
    }),
  );
}

export function createAiPost(
  useCase: UseCase<AskAiTeacherInput, AskAiTeacherOutput>,
) {
  return async function POST(request: Request) {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      const response = validationFailure();
      return NextResponse.json(response.body, { status: response.status });
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const response = validationFailure();
      return NextResponse.json(response.body, { status: response.status });
    }

    try {
      return NextResponse.json(await useCase.execute(parsed.data));
    } catch (error) {
      const response = mapErrorToHttp(error);
      return NextResponse.json(response.body, { status: response.status });
    }
  };
}

export const POST = createAiPost(askAiTeacher);

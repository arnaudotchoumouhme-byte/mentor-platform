import { NextResponse } from "next/server";
import { z } from "zod";
import type {
  DocumentUploadInput,
  ImportDocumentsInput,
  ImportDocumentsOutput,
} from "@/application/documents/import-documents";
import type { UseCase } from "@/application/contracts";
import { MAX_DOCUMENT_SIZE_BYTES } from "@/domain/documents/document-upload-policy";
import { importDocuments } from "@/infrastructure/documents/server-document-import";
import { mapErrorToHttp } from "@/presentation/api/http-error-mapper";
import { AppError } from "@/shared/errors/app-error";

const subjectSchema = z.string().trim().min(1).max(120).default("Non classé");
export const MAX_MULTIPART_REQUEST_BYTES = MAX_DOCUMENT_SIZE_BYTES + 2 * 1024 * 1024;
export const MAX_FILES_PER_UPLOAD = 10;

function validationFailure(message: string) {
  const response = mapErrorToHttp(
    new AppError({ code: "VALIDATION_ERROR", userMessage: message }),
  );
  return NextResponse.json(response.body, { status: response.status });
}

function requestFailure(status: 400 | 413 | 415, code: string, message: string) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status },
  );
}

export function createDocumentsPost(
  useCase: UseCase<ImportDocumentsInput, ImportDocumentsOutput>,
) {
  return async function POST(request: Request) {
    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.startsWith("multipart/form-data;") || !contentType.includes("boundary=")) {
      return requestFailure(415, "UNSUPPORTED_MEDIA_TYPE", "Un formulaire multipart valide est requis.");
    }

    const contentLength = request.headers.get("content-length");
    if (contentLength !== null) {
      if (!/^\d+$/.test(contentLength)) {
        return requestFailure(400, "INVALID_CONTENT_LENGTH", "En-tête Content-Length invalide.");
      }
      if (Number(contentLength) > MAX_MULTIPART_REQUEST_BYTES) {
        return requestFailure(413, "PAYLOAD_TOO_LARGE", "La requête d’import est trop volumineuse.");
      }
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return validationFailure("Formulaire d’import invalide.");
    }

    const unexpectedFields = [...form.keys()].filter(
      (key) => key !== "files" && key !== "subject",
    );
    if (unexpectedFields.length || form.getAll("subject").length > 1) {
      return validationFailure("Le formulaire contient des champs inattendus.");
    }

    const files = form
      .getAll("files")
      .filter((entry): entry is File => entry instanceof File);
    if (!files.length) return validationFailure("Aucun fichier sélectionné.");
    if (files.length > MAX_FILES_PER_UPLOAD) {
      return requestFailure(413, "TOO_MANY_FILES", "Le nombre maximal de fichiers est dépassé.");
    }

    const materializedSize = files.reduce((total, file) => total + file.size, 0);
    if (materializedSize > MAX_MULTIPART_REQUEST_BYTES) {
      return requestFailure(413, "PAYLOAD_TOO_LARGE", "La requête d’import est trop volumineuse.");
    }

    const subject = subjectSchema.safeParse(form.get("subject") ?? undefined);
    if (!subject.success) return validationFailure("Matière invalide.");

    const uploads: DocumentUploadInput[] = [];
    for (const file of files) {
      if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
        uploads.push({
          name: file.name,
          browserMediaType: file.type,
          size: file.size,
          bytes: new Uint8Array(),
        });
        continue;
      }
      uploads.push({
        name: file.name,
        browserMediaType: file.type,
        size: file.size,
        bytes: new Uint8Array(await file.arrayBuffer()),
      });
    }

    try {
      return NextResponse.json(await useCase.execute({ subject: subject.data, files: uploads }));
    } catch (error) {
      const response = mapErrorToHttp(error);
      return NextResponse.json(response.body, { status: response.status });
    }
  };
}

export const POST = createDocumentsPost(importDocuments);

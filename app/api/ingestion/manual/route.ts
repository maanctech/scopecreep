import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireApiPermission } from "@/lib/auth/api";
import { parseManualImport } from "@/lib/ingestion/manual";
import { importManualMessages } from "@/lib/ingestion/service";

const schema = z
  .object({
    projectId: z.uuid(),
    format: z.enum(["Text", "CSV", "JSON", "Transcript"]),
    content: z.string().min(1),
    action: z.enum(["preview", "import"]),
  })
  .strict();

function safeError(error: unknown) {
  if (error instanceof z.ZodError)
    return error.issues[0]?.message || "Invalid import.";

  if (error instanceof SyntaxError) return "The JSON import is not valid JSON.";

  if (
    error instanceof Error &&
    /5 MB|5,000|No valid messages|Project not found/.test(error.message)
  )
    return error.message;

  return "The communication import could not be processed.";
}

export async function POST(request: Request) {
  try {
    await requireApiPermission(request, "communications:write");
    const contentLength = Number(request.headers.get("content-length") || 0);

    if (
      Number.isFinite(contentLength) &&
      contentLength > 5 * 1024 * 1024 + 100_000
    ) {
      return NextResponse.json(
        { error: "Imports must be 5 MB or smaller." },
        { status: 413 },
      );
    }

    const body = schema.parse(await request.json());
    const preview = parseManualImport({
      content: body.content,
      format: body.format,
    });

    if (body.action === "preview") return NextResponse.json({ preview });

    return NextResponse.json(
      {
        result: await importManualMessages({
          projectId: body.projectId,
          preview,
        }),
      },
      { status: 201 },
    );
  } catch (error) {
    return (
      authErrorResponse(error) ||
      NextResponse.json(
        { error: safeError(error) },
        {
          status:
            error instanceof z.ZodError || error instanceof SyntaxError
              ? 400
              : 422,
        },
      )
    );
  }
}

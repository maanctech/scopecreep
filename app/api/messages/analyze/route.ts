import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeClientRequestDetailed, validateAnalysisResult } from "@/lib/analysis";
import { MAX_MESSAGE_LENGTH } from "@/lib/limits";
import { getProjectDetail, saveMessageWithFinding } from "@/lib/store";
import { MESSAGE_SOURCES } from "@/lib/types";
import { authErrorResponse, requireApiPermission } from "@/lib/auth/api";
import { approvedAnalysisContext } from "@/lib/analysisJobs/service";
import { usePostgresStorage } from "@/lib/runtimeStorage";

export const runtime = "nodejs";

const analyzeSchema = z.object({
  projectId: z.string().trim().min(1, "Project is required."),
  source: z.preprocess(
    (value) => (value === "" || value == null ? "Other" : value),
    z.enum(MESSAGE_SOURCES).default("Other")
  ),
  sender: z.string().trim().max(120).optional().nullable(),
  messageText: z
    .string()
    .trim()
    .min(2, "Message text is required.")
    .max(MAX_MESSAGE_LENGTH, `Client message must be ${MAX_MESSAGE_LENGTH.toLocaleString()} characters or less.`),
  messageDate: z.string().trim().max(40).optional().nullable()
});

function validationMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Invalid request.";
}

export async function POST(request: Request) {
  try {
    await requireApiPermission(request, "findings:review");
    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    const body = analyzeSchema.parse(json);
    const projectDetail = await getProjectDetail(body.projectId);
    if (!projectDetail) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const approved = usePostgresStorage() ? await approvedAnalysisContext(body.projectId) : null;
    const analyzed = await analyzeClientRequestDetailed({
      sowText: projectDetail.project.sow_text,
      boundaryMapText: approved?.boundaryMapText,
      messageText: body.messageText,
      hourlyRate: projectDetail.project.hourly_rate
    });
    if (analyzed.metadata.status === "Failed") {
      return NextResponse.json(
        { error: "AI analysis did not return a valid evidence-based result. No message or finding was saved. Check AI diagnostics and try again." },
        { status: 503 }
      );
    }
    const analysis = validateAnalysisResult(
      analyzed.analysis,
      projectDetail.project.hourly_rate
    );

    const saved = await saveMessageWithFinding({
      project_id: projectDetail.project.id,
      source: body.source,
      sender: body.sender,
      message_text: body.messageText,
      message_date: body.messageDate,
      analysis,
      analysis_metadata: analyzed.metadata,
      sow_version_id: approved?.sowVersionId,
      boundary_map_id: approved?.boundaryMapId
    });

    return NextResponse.json(
      {
        ...saved,
        ai: {
          provider: analyzed.metadata.provider,
          model: analyzed.metadata.model,
          promptVersion: analyzed.metadata.promptVersion,
          attempts: analyzed.metadata.attempts,
          status: analyzed.metadata.status
        }
      },
      { status: 201 }
    );
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    const boundaryError = error instanceof Error && /Approve a Scope Boundary Map|has no boundary items/.test(error.message);
    const status = error instanceof z.ZodError ? 400 : boundaryError ? 422 : 500;
    return NextResponse.json(
      {
        error:
          error instanceof z.ZodError
            ? validationMessage(error)
            : boundaryError
              ? error.message
              : "Failed to analyze message. Please try again."
      },
      { status }
    );
  }
}

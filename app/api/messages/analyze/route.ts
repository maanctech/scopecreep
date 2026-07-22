import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeClientRequest, validateAnalysisResult } from "@/lib/analysis";
import { MAX_MESSAGE_LENGTH } from "@/lib/limits";
import { getProjectDetail, saveMessageWithFinding } from "@/lib/store";
import { MESSAGE_SOURCES } from "@/lib/types";

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

    const analysis = validateAnalysisResult(
      await analyzeClientRequest({
        sowText: projectDetail.project.sow_text,
        messageText: body.messageText,
        hourlyRate: projectDetail.project.hourly_rate
      }),
      projectDetail.project.hourly_rate
    );

    const saved = await saveMessageWithFinding({
      project_id: projectDetail.project.id,
      source: body.source,
      sender: body.sender,
      message_text: body.messageText,
      message_date: body.messageDate,
      analysis
    });

    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 500;
    return NextResponse.json(
      {
        error:
          error instanceof z.ZodError
            ? validationMessage(error)
            : "Failed to analyze message. Please try again."
      },
      { status }
    );
  }
}

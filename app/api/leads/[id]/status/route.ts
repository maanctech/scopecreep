import { NextResponse } from "next/server";
import { z } from "zod";
import { updateLeadStatus } from "@/lib/store";
import { LEAD_STATUSES } from "@/lib/types";

export const runtime = "nodejs";

const statusSchema = z.object({
  status: z.enum(LEAD_STATUSES),
  note: z.string().trim().max(500).optional().nullable()
});

function validationMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Invalid request.";
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    const body = statusSchema.parse(json);
    const lead = await updateLeadStatus({
      lead_id: id,
      status: body.status,
      note: body.note
    });

    return NextResponse.json({ lead });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 500;
    return NextResponse.json(
      {
        error:
          error instanceof z.ZodError
            ? validationMessage(error)
            : error instanceof Error && error.message === "Lead not found."
              ? "Lead not found."
              : "Failed to update lead status."
      },
      { status: error instanceof Error && error.message === "Lead not found." ? 404 : status }
    );
  }
}

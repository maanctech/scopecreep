import { NextResponse } from "next/server";
import { z } from "zod";
import { TransitionError } from "@/lib/domain/findingTransitions";
import {
  getFindingDetail,
  NotFoundError,
  updateFindingDetails,
  VersionConflictError
} from "@/lib/store";
import { authErrorResponse, requireApiPermission } from "@/lib/auth/api";

export const runtime = "nodejs";

const MAX_TEXT_LENGTH = 4000;

const updateSchema = z
  .object({
    expected_version: z.number().int().min(1),
    approved_hours: z.number().finite().min(0).max(10000).nullable().optional(),
    approved_amount_cents: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
    client_facing_explanation: z.string().trim().min(1).max(MAX_TEXT_LENGTH).optional(),
    internal_note: z.string().trim().max(MAX_TEXT_LENGTH).nullable().optional()
  })
  .strict();

function validationMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Invalid request.";
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    await requireApiPermission(request, "findings:read");
    const detail = await getFindingDetail(id);
    if (!detail) {
      return NextResponse.json({ error: "Finding not found." }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    return NextResponse.json({ error: "Failed to load the finding." }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireApiPermission(request, "findings:review");
    const { id } = await context.params;
    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    const body = updateSchema.parse(json);
    const finding = await updateFindingDetails({
      finding_id: id,
      expected_version: body.expected_version,
      approved_hours: body.approved_hours,
      approved_amount_cents: body.approved_amount_cents,
      client_facing_explanation: body.client_facing_explanation,
      internal_note: body.internal_note
    });

    return NextResponse.json({ finding });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: validationMessage(error) }, { status: 400 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof VersionConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof TransitionError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update the finding." }, { status: 500 });
  }
}

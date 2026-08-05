import { NextResponse } from "next/server";
import { z } from "zod";
import { FINDING_ACTIONS, TransitionError } from "@/lib/domain/findingTransitions";
import { NotFoundError, performFindingAction, VersionConflictError } from "@/lib/store";
import { authErrorResponse, requireApiPermission } from "@/lib/auth/api";

export const runtime = "nodejs";

const actionSchema = z
  .object({
    action: z.enum(FINDING_ACTIONS),
    expected_version: z.number().int().min(1),
    note: z.string().trim().max(500).optional().nullable(),
    review: z.object({
      approved_hours: z.number().finite().min(0).max(10000).nullable().optional(),
      approved_amount_cents: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
      client_facing_explanation: z.string().trim().min(1).max(4000).optional(),
      internal_note: z.string().trim().max(4000).nullable().optional(),
    }).strict().optional(),
  })
  .strict();

function validationMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Invalid request.";
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireApiPermission(request, "billing:write");
    const { id } = await context.params;
    let json: unknown;

    try {
      json = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    const body = actionSchema.parse(json);
    const finding = await performFindingAction({
      finding_id: id,
      expected_version: body.expected_version,
      action: body.action,
      note: body.note,
      review: body.review,
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
      return NextResponse.json(
        { error: error.message, finding: error.currentFinding },
        { status: 409 },
      );
    }

    if (error instanceof TransitionError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to update the finding." }, { status: 500 });
  }
}

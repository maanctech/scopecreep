import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_HOURLY_RATE, MAX_MESSAGE_LENGTH, MAX_SOW_LENGTH } from "@/lib/limits";
import { createAuditRequest } from "@/lib/store";
import { NotFoundError } from "@/lib/storeErrors";
import { authErrorResponse, requestIp } from "@/lib/auth/api";
import { assertSameOrigin, checkRateLimit } from "@/lib/auth/security";
import { auditIntakeCookieValue } from "@/lib/publicIntake";
import { clearAuditIntakeCookie } from "@/lib/auth/cookies";

export const runtime = "nodejs";

const blankToUndefined = (value: unknown) => (value === "" || value == null ? undefined : value);

const auditRequestSchema = z.object({
  client_name: z.string().trim().min(2, "Client name is required.").max(160),
  project_value: z.preprocess(
    blankToUndefined,
    z.coerce.number().finite().nonnegative().max(100000000).optional()
  ),
  hourly_rate: z.coerce
    .number()
    .finite()
    .positive("Hourly rate must be greater than 0.")
    .max(MAX_HOURLY_RATE, `Hourly rate must be ${MAX_HOURLY_RATE.toLocaleString()} or less.`),
  sow_text: z
    .string()
    .trim()
    .min(20, "Paste enough SOW text to analyze scope.")
    .max(MAX_SOW_LENGTH, `SOW text must be ${MAX_SOW_LENGTH.toLocaleString()} characters or less.`),
  message_export_text: z
    .string()
    .trim()
    .min(2, "Paste at least one client message or summary.")
    .max(MAX_MESSAGE_LENGTH * 6, "Message export is too long for the local MVP."),
  suspected_scope_creep_notes: z.string().trim().max(2000).optional().nullable()
});

function validationMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Invalid request.";
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    checkRateLimit(`audit-request:${requestIp(request)}`, 6, 60 * 60 * 1000);
    let json: unknown;

    try {
      json = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    const body = auditRequestSchema.parse(json);
    const intakeToken = auditIntakeCookieValue(request);

    if (!intakeToken) {
      throw new NotFoundError("Audit link is invalid or expired.");
    }

    const created = await createAuditRequest({
      ...body,
      intake_token: intakeToken,
      project_value: body.project_value ?? null,
      suspected_scope_creep_notes: body.suspected_scope_creep_notes || null
    });
    const response = NextResponse.json(
      { ok: true, importedCount: created.importResult.inserted },
      { status: 201 },
    );

    clearAuditIntakeCookie(response);

    return response;
  } catch (error) {
    const authResponse = authErrorResponse(error);

    if (authResponse) return authResponse;

    const expectedError = error instanceof z.ZodError || error instanceof NotFoundError;
    const status = expectedError ? 400 : 500;

    return NextResponse.json(
      {
        error:
          error instanceof z.ZodError
            ? validationMessage(error)
            : error instanceof NotFoundError
              ? error.message
            : "Failed to save audit request. Please try again."
      },
      { status }
    );
  }
}

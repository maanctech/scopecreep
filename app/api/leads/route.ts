import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_HOURLY_RATE } from "@/lib/limits";
import { createLead } from "@/lib/store";
import { authErrorResponse, requestIp } from "@/lib/auth/api";
import { assertSameOrigin, checkRateLimit } from "@/lib/auth/security";

export const runtime = "nodejs";

const blankToUndefined = (value: unknown) => (value === "" || value == null ? undefined : value);

const leadSchema = z.object({
  name: z.string().trim().min(2, "Name is required.").max(120),
  email: z.string().trim().email("A valid email is required.").max(200),
  company: z.string().trim().min(2, "Company is required.").max(160),
  website: z.string().trim().max(240).optional().nullable(),
  business_type: z.string().trim().min(2, "Business type is required.").max(80),
  team_size: z.string().trim().min(1, "Team size is required.").max(80),
  average_project_value: z.preprocess(
    blankToUndefined,
    z.coerce.number().finite().nonnegative().max(100000000).optional()
  ),
  hourly_rate: z.preprocess(
    blankToUndefined,
    z.coerce.number().finite().positive().max(MAX_HOURLY_RATE).optional()
  ),
  pain_point: z.string().trim().min(10, "Describe the scope creep pain point.").max(2000),
  consent_to_contact: z.boolean().refine((value) => value, "Consent is required before requesting an audit.")
});

function validationMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Invalid request.";
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    checkRateLimit(`lead-capture:${requestIp(request)}`, 8, 60 * 60 * 1000);
    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    const body = leadSchema.parse(json);
    const lead = await createLead({
      ...body,
      website: body.website || null,
      average_project_value: body.average_project_value ?? null,
      hourly_rate: body.hourly_rate ?? null
    });

    return NextResponse.json({ lead }, { status: 201 });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    const status = error instanceof z.ZodError ? 400 : 500;
    return NextResponse.json(
      {
        error:
          error instanceof z.ZodError
            ? validationMessage(error)
            : "Failed to save lead. Please try again."
      },
      { status }
    );
  }
}

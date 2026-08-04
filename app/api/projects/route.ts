import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_HOURLY_RATE, MAX_SOW_LENGTH } from "@/lib/limits";
import { createProject, getAppDashboard } from "@/lib/store";
import { authErrorResponse, requireApiPermission } from "@/lib/auth/api";

export const runtime = "nodejs";

const blankToUndefined = (value: unknown) => (value === "" || value == null ? undefined : value);

const projectSchema = z.object({
  client_name: z.string().trim().min(2, "Client name is required.").max(160),
  project_name: z.string().trim().min(2, "Project name is required.").max(160),
  hourly_rate: z.coerce
    .number()
    .finite()
    .positive("Hourly rate must be greater than 0.")
    .max(MAX_HOURLY_RATE, `Hourly rate must be ${MAX_HOURLY_RATE.toLocaleString()} or less.`),
  project_value: z.preprocess(
    blankToUndefined,
    z.coerce.number().finite().nonnegative().max(100000000).optional()
  ),
  sow_text: z
    .string()
    .trim()
    .min(20, "Paste enough SOW text to analyze scope.")
    .max(MAX_SOW_LENGTH, `SOW text must be ${MAX_SOW_LENGTH.toLocaleString()} characters or less.`)
});

function validationMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Invalid request.";
}

export async function GET(request: Request) {
  try {
    await requireApiPermission(request, "projects:read");

    return NextResponse.json(await getAppDashboard());
  } catch (error) {
    return authErrorResponse(error) || NextResponse.json({ error: "Failed to load projects." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireApiPermission(request, "projects:write");
    let json: unknown;

    try {
      json = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    const body = projectSchema.parse(json);
    const project = await createProject({
      ...body,
      project_value: body.project_value ?? null
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    const authResponse = authErrorResponse(error);

    if (authResponse) return authResponse;

    const status = error instanceof z.ZodError ? 400 : 500;

    return NextResponse.json(
      {
        error:
          error instanceof z.ZodError
            ? validationMessage(error)
            : "Failed to create project. Please try again."
      },
      { status }
    );
  }
}

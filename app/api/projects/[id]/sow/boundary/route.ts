import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireApiPermission } from "@/lib/auth/api";
import { BOUNDARY_TYPES } from "@/lib/sow/types";
import { saveBoundaryMap } from "@/lib/sow/service";

const schema = z.object({
  mapId: z.string().uuid(),
  approve: z.boolean(),
  items: z.array(z.object({ boundaryType: z.enum(BOUNDARY_TYPES), category: z.string().trim().min(1).max(120), description: z.string().trim().min(1).max(1000), evidence: z.string().trim().min(1).max(1500) }).strict()).min(1).max(100)
}).strict();

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireApiPermission(request, "projects:write");
    const { id } = await params;
    const body = schema.parse(await request.json());
    return NextResponse.json(await saveBoundaryMap({ projectId: id, ...body }));
  } catch (error) {
    const auth = authErrorResponse(error);
    return auth || NextResponse.json({ error: error instanceof z.ZodError ? error.issues[0]?.message : "The boundary map could not be saved." }, { status: error instanceof z.ZodError ? 400 : 422 });
  }
}

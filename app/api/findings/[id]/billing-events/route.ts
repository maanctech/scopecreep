import { NextResponse } from "next/server";
import { getFindingDetail } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const detail = await getFindingDetail(id);
    if (!detail) {
      return NextResponse.json({ error: "Finding not found." }, { status: 404 });
    }
    return NextResponse.json({ events: detail.events });
  } catch {
    return NextResponse.json({ error: "Failed to load billing events." }, { status: 500 });
  }
}

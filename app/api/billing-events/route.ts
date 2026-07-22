import { NextResponse } from "next/server";
import { formatCents } from "@/lib/domain/money";
import { getBillingEvents } from "@/lib/store";
import { authErrorResponse, requireApiPermission } from "@/lib/auth/api";

export const runtime = "nodejs";

function csvCell(value: string | null | undefined) {
  const text = value ?? "";
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * Read-only billing event log. `?format=csv` returns a simple CSV export;
 * the default is JSON. There is no invoice generation or payment processing.
 */
export async function GET(request: Request) {
  try {
    await requireApiPermission(request, "billing:read");
    const events = await getBillingEvents();
    const url = new URL(request.url);

    if (url.searchParams.get("format") !== "csv") {
      return NextResponse.json({ events: events.map((row) => row.event) });
    }

    const header = [
      "created_at",
      "event_type",
      "client",
      "project",
      "finding_request",
      "amount",
      "previous_status",
      "new_status",
      "previous_decision",
      "new_decision",
      "actor",
      "note",
      "is_demo"
    ].join(",");

    const lines = events.map(({ event, finding, project }) =>
      [
        csvCell(event.created_at),
        csvCell(event.event_type),
        csvCell(project?.client_name ?? ""),
        csvCell(project?.project_name ?? ""),
        csvCell(finding ? `${finding.classification}: ${finding.reasoning.slice(0, 120)}` : ""),
        csvCell(event.amount_cents === null ? "" : formatCents(event.amount_cents)),
        csvCell(event.previous_status),
        csvCell(event.new_status),
        csvCell(event.previous_decision),
        csvCell(event.new_decision),
        csvCell(event.actor),
        csvCell(event.note),
        csvCell(event.is_demo ? "yes" : "no")
      ].join(",")
    );

    return new NextResponse([header, ...lines].join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="billing-events.csv"'
      }
    });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    return NextResponse.json({ error: "Failed to load billing events." }, { status: 500 });
  }
}

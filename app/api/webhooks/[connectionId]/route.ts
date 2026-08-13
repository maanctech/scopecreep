import { NextResponse } from "next/server";
import { RateLimitError } from "@/lib/auth/security";
import { enforceRateLimit } from "@/lib/auth/rateLimit";
import { requestIp } from "@/lib/auth/api";
import { receiveWebhook } from "@/lib/ingestion/webhook";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ connectionId: string }> },
) {
  try {
    await enforceRateLimit(`webhook:${requestIp(request)}`, 120, 60_000);
    const contentLength = Number(request.headers.get("content-length") || 0);

    if (Number.isFinite(contentLength) && contentLength > 1_000_000) {
      return NextResponse.json(
        { error: "Webhook payloads must be 1 MB or smaller." },
        { status: 413 },
      );
    }

    const { connectionId } = await params;
    const result = await receiveWebhook({
      connectionId,
      deliveryId: request.headers.get("x-scopeledger-delivery-id") || "",
      timestamp: request.headers.get("x-scopeledger-timestamp") || "",
      signature: request.headers.get("x-scopeledger-signature") || "",
      body: await request.text(),
    });

    return NextResponse.json(
      { result },
      { status: result.replayed ? 200 : 202 },
    );
  } catch (error) {
    if (error instanceof RateLimitError)
      return NextResponse.json({ error: error.message }, { status: 429 });

    const message =
      error instanceof Error && /1 MB/.test(error.message)
        ? error.message
        : "Webhook delivery was rejected.";

    return NextResponse.json(
      { error: message },
      { status: /1 MB/.test(message) ? 413 : 401 },
    );
  }
}

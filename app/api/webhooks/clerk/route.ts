import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { NextResponse, type NextRequest } from "next/server";
import { applyClerkEvent } from "@/lib/auth/clerkSync";

/**
 * The signature is the only authentication here, so a body that fails it is
 * refused before anything reads it. A failure afterwards answers 500 instead,
 * because that is what makes Clerk retry rather than drop the change.
 */
export async function POST(request: NextRequest) {
  let event;

  try {
    event = await verifyWebhook(request);
  } catch {
    return NextResponse.json({ error: "Webhook signature verification failed." }, { status: 400 });
  }

  await applyClerkEvent({ type: event.type, data: event.data as unknown as Record<string, unknown> });

  return NextResponse.json({ received: true });
}

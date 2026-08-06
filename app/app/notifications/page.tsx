import { NotificationInbox } from "@/components/notifications/NotificationInbox";
import { requirePagePermission } from "@/lib/auth/current";
import {
  getNotificationPreference,
  listProfessionalNotifications,
} from "@/lib/notifications/service";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  await requirePagePermission("findings:review");
  const [notifications, preference] = await Promise.all([
    listProfessionalNotifications(),
    getNotificationPreference(),
  ]);

  return (
    <div className="space-y-7">
      <section className="border-b border-audit-border pb-7">
        <p className="text-sm font-medium text-audit-muted">Professional review only</p>
        <h1 className="mt-2 text-3xl font-semibold">Review inbox</h1>
        <p className="mt-3 max-w-3xl text-base/7 text-zinc-700">
          Findings, evidence changes, and monitoring failures appear here. ScopeLedger
          does not contact clients or make billing decisions.
        </p>
      </section>
      <NotificationInbox
        initialNotifications={notifications}
        initialDigestEnabled={preference.daily_digest_enabled}
        initialDelivery={preference.last_delivery}
      />
    </div>
  );
}

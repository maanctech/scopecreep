import { NotificationInbox } from "@/components/notifications/NotificationInbox";
import { Page, PageHeader } from "@/components/ui/Page";
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
    <Page>
      <PageHeader eyebrow="Primary daily workflow" title="Needs review" description="New findings, changed source evidence, failed analyses, and monitoring failures appear here. ScopeLedger does not contact clients or make billing decisions." />
      <NotificationInbox
        initialNotifications={notifications}
        initialDigestEnabled={preference.daily_digest_enabled}
        initialDelivery={preference.last_delivery}
      />
    </Page>
  );
}

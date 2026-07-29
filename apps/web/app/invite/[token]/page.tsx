import { InvitationOnboarding } from "../../../src/features/access/invitation-onboarding";

/** Shows one deployment-bound invitation in the responsive member web experience. */
export default async function InvitationPage({
  params,
}: Readonly<{ params: Promise<{ token: string }> }>) {
  const { token } = await params;
  return (
    <main className="access-page">
      <InvitationOnboarding publicToken={token} />
    </main>
  );
}

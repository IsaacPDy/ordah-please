import { Users } from "lucide-react";

import { EmptyPage } from "../../components/empty-page";

/** Shows the member team destination without inventing group members. */
export default function TeamPage() {
  return (
    <EmptyPage
      description="Group members and roles will appear after your invitation is accepted."
      emptyTitle="No team details yet"
      icon={Users}
      title="Team"
    />
  );
}

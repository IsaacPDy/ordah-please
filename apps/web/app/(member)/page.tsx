import { CircleCheck } from "lucide-react";

import { EmptyPage } from "../components/empty-page";

/** Shows the member home shell without inventing an active order. */
export default function MemberHomePage() {
  return (
    <EmptyPage
      description="Active orders and restaurant updates will appear here."
      emptyTitle="Nothing needs your attention yet"
      icon={CircleCheck}
      title="Your home"
    />
  );
}

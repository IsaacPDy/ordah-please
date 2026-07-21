import { ShieldCheck } from "lucide-react";

import { EmptyPage } from "../components/empty-page";

/** Shows the admin overview shell before real operational records exist. */
export default function AdminHomePage() {
  return (
    <EmptyPage
      description="Catalog reviews, refresh failures, and access requests will appear here."
      emptyTitle="No admin work is waiting"
      icon={ShieldCheck}
      title="Admin overview"
    />
  );
}

"use client";

import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const ROOT_MEMBER_ROUTES = new Set(["/", "/favorites", "/groups", "/orders"]);

/** Shows a back control only on nested member pages where a parent screen exists. */
export function MemberBackButton() {
  const pathname = usePathname();
  const router = useRouter();

  if (ROOT_MEMBER_ROUTES.has(pathname)) {
    return <span aria-hidden="true" className="member-header__spacer" />;
  }

  return (
    <button
      aria-label="Go back"
      className="member-back-button"
      onClick={() => router.back()}
      type="button"
    >
      <ArrowLeft aria-hidden="true" size={25} strokeWidth={2.2} />
    </button>
  );
}

/** Keeps the primary new-order action reachable where an equivalent page action is absent. */
export function FloatingNewOrderButton({
  visible,
}: {
  readonly visible: boolean;
}) {
  const pathname = usePathname();

  const pageAlreadyHasNewOrderAction =
    pathname.startsWith("/orders/new") ||
    pathname.startsWith("/groups/") ||
    pathname.startsWith("/restaurants/");

  if (!visible || pageAlreadyHasNewOrderAction) {
    return null;
  }

  return (
    <Link
      aria-label="Start a new order"
      className="floating-new-order"
      href="/orders/new"
    >
      <Plus aria-hidden="true" size={30} strokeWidth={2} />
    </Link>
  );
}

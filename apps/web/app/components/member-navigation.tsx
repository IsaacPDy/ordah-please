"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { memberNavigation } from "../shell-navigation";

/** Renders member destinations and exposes the current page to sighted and assistive-technology users. */
export function MemberNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Member navigation" className="member-navigation">
      {memberNavigation.map((item) => {
        const Icon = item.icon;
        const isCurrent = pathname === item.href;

        return (
          <Link
            aria-current={isCurrent ? "page" : undefined}
            className="member-navigation__link"
            href={item.href}
            key={item.href}
          >
            <Icon aria-hidden="true" size={24} strokeWidth={2.2} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

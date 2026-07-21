"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { adminNavigation } from "../shell-navigation";

/** Renders the independent admin destination list with a visible current-page state. */
export function AdminNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin navigation" className="admin-navigation">
      {adminNavigation.map((item) => {
        const Icon = item.icon;
        const isCurrent = pathname === item.href;

        return (
          <Link
            aria-current={isCurrent ? "page" : undefined}
            className="admin-navigation__link"
            href={item.href}
            key={item.href}
          >
            <Icon aria-hidden="true" size={20} strokeWidth={2} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

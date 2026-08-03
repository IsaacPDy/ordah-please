import type { ReactNode } from "react";

type AdminPageProps = Readonly<{
  actions?: ReactNode;
  children: ReactNode;
  description: string;
  eyebrow: string;
  title: string;
}>;

/** Gives every admin workspace the same dense title, context, and action hierarchy. */
export function AdminPage({
  actions,
  children,
  description,
  eyebrow,
  title,
}: AdminPageProps) {
  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {actions === undefined ? null : (
          <div className="admin-page__actions">{actions}</div>
        )}
      </header>
      {children}
    </div>
  );
}

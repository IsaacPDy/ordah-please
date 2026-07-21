import type { LucideIcon } from "lucide-react";

type EmptyPageProps = Readonly<{
  description: string;
  emptyTitle: string;
  icon: LucideIcon;
  title: string;
}>;

/** Renders an accessible shell state that explains the absence of real feature data. */
export function EmptyPage({
  description,
  emptyTitle,
  icon: Icon,
  title,
}: EmptyPageProps) {
  return (
    <section aria-labelledby="page-title" className="empty-page">
      <h1 className="empty-page__heading" id="page-title">
        {title}
      </h1>
      <div className="empty-card">
        <span aria-hidden="true" className="empty-card__icon">
          <Icon size={32} strokeWidth={2} />
        </span>
        <h2>{emptyTitle}</h2>
        <p>{description}</p>
      </div>
    </section>
  );
}

import { Heart } from "lucide-react";

import { EmptyPage } from "../../components/empty-page";

/** Shows the member favorites destination without restaurant placeholders. */
export default function FavoritesPage() {
  return (
    <EmptyPage
      description="Saved food combinations will appear after you choose a restaurant."
      emptyTitle="No favorites yet"
      icon={Heart}
      title="Favorites"
    />
  );
}

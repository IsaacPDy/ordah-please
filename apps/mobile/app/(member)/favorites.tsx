import { Heart } from "lucide-react-native";

import { ShellScreen } from "../../src/components/shell-screen";

/** Shows the favorites destination without creating restaurant or menu placeholders. */
export default function FavoritesScreen() {
  return (
    <ShellScreen
      description="Saved food combinations will appear after you choose a restaurant."
      emptyTitle="No favorites yet"
      icon={Heart}
      title="Favorites"
    />
  );
}

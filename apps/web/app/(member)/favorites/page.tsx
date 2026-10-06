import { getCurrentServerPageIdentity } from "../../../src/auth/load-server-page-identity";
import { favoritesRuntime } from "../../../src/features/favorites/favorites-runtime";
import { MemberAccessState } from "../../components/member-access-state";
import { FavoritesView } from "./favorites-view";
import { groupFavoritesByBranch } from "./favorites-data";

/** Favorites tab: the member's saved favorite meals, ranked per restaurant. */
export default async function FavoritesPage() {
  const identityResult = await getCurrentServerPageIdentity();
  const hasMemberships =
    identityResult.status === "authenticated" &&
    identityResult.identity.memberships.length > 0;

  const groups =
    identityResult.status === "authenticated"
      ? groupFavoritesByBranch(
          await favoritesRuntime.listFavoritesForUser(
            identityResult.identity.userId,
          ),
        )
      : [];

  return (
    <MemberAccessState hasMemberships={hasMemberships} surface="favorites">
      <div className="member-page favorites-page">
        <header className="page-intro">
          <p className="eyebrow">Your favorite meals</p>
          <h1>The meals you always come back to.</h1>
          <p>Save time on your next group order with your favorites.</p>
        </header>
        <FavoritesView groups={groups} />
      </div>
    </MemberAccessState>
  );
}

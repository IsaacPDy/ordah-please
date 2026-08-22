import { getCurrentServerPageIdentity } from "../../../src/auth/load-server-page-identity";
import { favoritesRuntime } from "../../../src/features/favorites/favorites-runtime";
import { MemberAccessState } from "../../components/member-access-state";
import { FavoritesView, groupFavoritesByBranch } from "./favorites-view";

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
      <div className="member-page">
        <header className="page-intro">
          <p className="eyebrow">Your usual orders</p>
          <h1>Favorites</h1>
          <p>Save combinations you want ready when a group order starts.</p>
        </header>
        <FavoritesView groups={groups} />
      </div>
    </MemberAccessState>
  );
}

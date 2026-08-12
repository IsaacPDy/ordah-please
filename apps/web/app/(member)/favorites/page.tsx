import { getCurrentServerPageIdentity } from "../../../src/auth/load-server-page-identity";
import { MemberAccessState } from "../../components/member-access-state";

/** Favorites tab. Empty state until the Favorites bundle ships. */
export default async function FavoritesPage() {
  const identityResult = await getCurrentServerPageIdentity();
  const hasMemberships =
    identityResult.status === "authenticated" &&
    identityResult.identity.memberships.length > 0;

  return (
    <MemberAccessState hasMemberships={hasMemberships} surface="favorites">
      <div className="member-page">
        <header className="page-intro">
          <p className="eyebrow">Your usual orders</p>
          <h1>Favorites</h1>
          <p>
            Your top three combinations will be ready when a group order starts.
          </p>
        </header>
        <p className="restaurant-empty">
          No favorites yet — browse restaurants to add your first one.
        </p>
      </div>
    </MemberAccessState>
  );
}

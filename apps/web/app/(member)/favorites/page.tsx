import Image from "next/image";
import { Edit3, Heart, MoreHorizontal, Trash2 } from "lucide-react";

import { getCurrentServerPageIdentity } from "../../../src/auth/load-server-page-identity";
import { MemberAccessState } from "../../components/member-access-state";

/** Groups the user's ranked food combinations under each exact restaurant branch. */
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
            Your top three combinations are ready when a group order starts.
          </p>
        </header>
        <article className="favorite-restaurant">
          <header className="favorite-restaurant__header">
            <Image
              alt="Green Table food"
              height={72}
              src="/images/green-table.jpg"
              width={72}
            />
            <div>
              <h2>Green Table · BGC</h2>
              <p>3 saved combinations</p>
            </div>
            <button
              aria-label="More Green Table options"
              className="icon-button"
              type="button"
            >
              <MoreHorizontal aria-hidden="true" />
            </button>
          </header>
          <ol className="favorite-ranks">
            <li>
              <span className="rank-badge">Rank 1</span>
              <div>
                <strong>Grilled chicken plate</strong>
                <p>Garlic rice · Macaroni soup · No onions</p>
              </div>
              <strong>₱245</strong>
              <button
                aria-label="Edit grilled chicken combination"
                className="icon-button"
                title="Edit combination"
                type="button"
              >
                <Edit3 aria-hidden="true" size={18} />
              </button>
            </li>
            <li>
              <span className="rank-badge rank-badge--two">Rank 2</span>
              <div>
                <strong>Beef tapa breakfast</strong>
                <p>Extra egg · Iced tea</p>
              </div>
              <strong>₱225</strong>
              <button
                aria-label="Edit beef tapa combination"
                className="icon-button"
                title="Edit combination"
                type="button"
              >
                <Edit3 aria-hidden="true" size={18} />
              </button>
            </li>
            <li>
              <span className="rank-badge rank-badge--three">Rank 3</span>
              <div>
                <strong>Chicken pesto pasta</strong>
                <p>Regular · No drink</p>
              </div>
              <strong>₱210</strong>
              <button
                aria-label="Edit chicken pesto combination"
                className="icon-button"
                title="Edit combination"
                type="button"
              >
                <Edit3 aria-hidden="true" size={18} />
              </button>
            </li>
          </ol>
          <div className="favorite-restaurant__actions">
            <button className="secondary-action" type="button">
              <Heart aria-hidden="true" size={18} /> Add another
            </button>
            <button className="danger-action" type="button">
              <Trash2 aria-hidden="true" size={18} /> Remove restaurant
              favorites
            </button>
          </div>
        </article>
      </div>
    </MemberAccessState>
  );
}

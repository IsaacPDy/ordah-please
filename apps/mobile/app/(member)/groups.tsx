import { MobileMemberAccessState } from "../../src/features/access/member-access-state";
import { useMobileAppIdentity } from "../../src/features/access/mobile-member-gate";

/** Shows only the group memberships returned by the authenticated backend identity. */
export default function GroupsScreen() {
  const identity = useMobileAppIdentity();

  return (
    <MobileMemberAccessState identity={identity} surface="groups">
      {null}
    </MobileMemberAccessState>
  );
}

import { useRouter } from "expo-router";

import { MobileMemberAccessState } from "../../src/features/access/member-access-state";
import { useMobileAppIdentity } from "../../src/features/access/mobile-member-gate";

/** Lists the user's groups; tapping one opens its Group details screen. */
export default function GroupsScreen() {
  const identity = useMobileAppIdentity();
  const router = useRouter();

  return (
    <MobileMemberAccessState
      identity={identity}
      onSelectGroup={(groupId) => {
        void router.push(`/groups/${groupId}`);
      }}
      surface="groups"
    >
      {null}
    </MobileMemberAccessState>
  );
}

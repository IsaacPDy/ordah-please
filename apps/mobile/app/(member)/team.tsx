import { Users } from "lucide-react-native";

import { ShellScreen } from "../../src/components/shell-screen";

/** Shows the team destination without inventing members before access is implemented. */
export default function TeamScreen() {
  return (
    <ShellScreen
      description="Group members and roles will appear after your invitation is accepted."
      emptyTitle="No team details yet"
      icon={Users}
      title="Team"
    />
  );
}

# Product Decisions Questionnaire

Edit this file directly. Write each response after **Answer:**. Short answers are fine. If the recommended choice is acceptable, write **Use recommendation**.

These decisions are already approved:

- Google accounts are the only sign-in method.
- A user may join multiple groups.
- A user may have a different role in each group.
- Group roles are Member, Manager, and Group Owner.
- Platform Admin is an app-wide permission, not a group role.
- Signed-in users may browse restaurants and manage personal favorites before joining a group.
- Role permissions are the defaults until a Platform Admin creates an account-wide override.
- UI is implemented directly in code from the approved Option 1 reference; do not create or update Figma unless the user reverses this decision.

## 1. Account Access

### A1. Who may enter the app?

Choose one: any Google account, only a Platform Admin-approved Google account, or only a Google account with an invitation.

**Answer:** Any Google account may sign in and enter the restaurant-and-Favorites area of the app.

### A2. If approval or invitation is required, who may provide it?

Choose any: Platform Admin, Group Owner, Manager.

**Answer:** Group Owners and the Platform Admin may invite or add users to groups. Managers may not. A Platform Admin may also be a Group Owner in the mobile app and may create groups through the admin system.

### A3. What should an unapproved user see after Google sign-in?

Examples: waiting-for-approval page, access-denied page, or restaurants in read-only mode.

**Answer:** A signed-in user is neither approved nor unapproved. Before joining a group, they may browse restaurants and manage Favorites but cannot access group or order features. A Platform Admin may add them to a group, or a Group Owner may invite them with a link.

### A4. May a Platform Admin suspend an entire user account?

If yes, state what the suspended user may still see.

**Answer:** Yes. Group suspension makes that group read-only, preserves its history, and shows a Suspended tag on its group card. App suspension blocks the whole app and shows a full-screen suspension message.






## 2. Groups and Membership

### G1. Who may create a new group?

Choose any: every signed-in user, Platform Admin only, or another rule.

**Answer:** Platform Admin and Group Owner only. The Platform Admin may select an account in the admin system and grant Group Owner status. A user with Group Owner status receives a Create group action.

### G2. How many owners may one group have?

Choose one: exactly one owner or multiple owners.

**Answer:** A group has exactly one Group Owner and may have multiple Managers. A Member promoted by the Group Owner must accept or reject the Manager role. A Platform Admin may assign the Manager role without acceptance.

### G3. How does a user join a group?

Choose any: invitation link, owner adds the user, user requests to join, or another method.

**Answer:** A Group Owner may add a user or share an invitation link. A Platform Admin may add a user by dragging the user into a group in the admin system.

### G4. May a Member leave a group without approval?

**Answer:** A Member may leave without approval. Their historical participation remains in the group records.

### G5. What happens when a Manager or Group Owner wants to leave?

Include whether ownership must be transferred first.

**Answer:** A Manager requests to leave and may leave after approval. When the Group Owner leaves, the group is archived and all history is preserved.

### G6. May a removed user rejoin the same group later?

**Answer:** Yes. A removed user may rejoin the same group later.

### G7. May a group be deleted, or only archived?

Recommendation: archive it so order history is never destroyed.

**Answer:** Groups are archived, never hard-deleted, so their order and membership history remains available.

### G8. Who may change a user's group role?

State who may promote, demote, or transfer ownership.

**Answer:** The Platform Admin may change all group roles. A Group Owner may promote or demote users only inside their own group. A Manager may promote a Member to Manager and demote a Manager to Member. Members cannot change roles. Group ownership is not transferable.

### G9. What information may every group member see about other members?

Choose any: display name, profile photo, role, email address, order participation, or other information.

**Answer:** Display name, profile photo, role, email address, and order participation.








## 3. Default Group-Role Permissions

For every row, replace each blank with **Yes** or **No**. Add a short condition when needed.

| Permission | Member | Manager | Group Owner |
| --- | --- | --- | --- |
| View group details |yes|yes|yes|
| View the group's member list |yes|yes|yes|
| Invite a user |no|yes|yes|
| Approve a join request |no|yes|yes|
| Remove a member |no|yes|yes|
| Promote a Member to Manager |no|yes|yes|
| Demote a Manager to Member |no|yes|yes|
| Transfer group ownership |no|no|no|
| Edit the group name or image |no|yes|yes|
| Edit the group's default delivery address |no|yes|yes|
| Create an order |no|yes|yes|
| Edit an order draft |no|yes|yes|
| Select order participants |no|yes|yes|
| Choose restaurants for an order |if voting is enabled|yes, but override when voting is enabled|yes, but override when voting is enabled|
| Set voting and food deadlines |no|yes|yes|
| Start an order |no|yes|yes|
| Vote when selected as a participant |yes|yes|yes|
| Confirm or decline personal food |yes|yes|yes|
| Resolve another participant's missing food |no|yes|yes|
| View the final handoff |yes|yes|yes|
| Open Grab for manual ordering |no|yes|yes|
| Mark an order Ordered or Cancelled |no|yes|yes|
| Upload a receipt |only when enabled for the order|yes|yes|
| View a receipt |full-order receipts and their own member receipts|yes|yes|
| View all group order history |yes|yes|yes| if a member only, they should be only able to view their own order

### P1. Do higher roles inherit lower-role permissions?

Recommendation: Manager inherits Member; Group Owner inherits Manager and Member.

**Answer:** Yes. Manager inherits Member permissions; Group Owner inherits Manager and Member permissions.

### P2. Are any default role permissions missing from the table?

**Answer:** No additional default role permissions are required.







## 4. Platform Admin and Account-Wide Overrides

### PA1. May an override both grant and remove permissions?

Choose one: grant only, remove only, or both. 

**Answer:** Both grant and remove permissions.

### PA2. Which permissions may never be overridden?

Examples: ownership transfer, audit-log deletion, another Platform Admin's access, or none.

**Answer:** The Platform Admin's protected admin access and protected self-management permissions may never be overridden. Group ownership transfer does not exist.

### PA3. How should an account-wide override affect group-specific permissions?

Example: if “Manage members” is granted, does the user receive it in every group even where they are only a Member?

**Answer:** There is no generic “Manage members” override. The Platform Admin overrides individual actions such as Invite, Approve, Remove, Promote, or Demote. An account-wide override applies that action to every group the user belongs to.

### PA4. Must the Platform Admin enter a reason before saving an override?

Recommendation: yes.

**Answer:** No. A reason is optional.

### PA5. Must every override and removal be stored permanently in the audit log?

Recommendation: yes.

**Answer:** Yes. The app automatically records who changed which permission and when.

### PA6. Does an override remain until manually removed, or may it expire automatically?

**Answer:** The override remains stored and active until the Platform Admin manually removes it. The audit event records when the override was created or removed.

### PA7. Should the affected user be notified when an override changes?

**Answer:** No. The affected user is not notified.

### PA8. May a Platform Admin override their own permissions or another Platform Admin's permissions?

Recommendation: no self-override; require another Platform Admin for changes to an admin.

**Answer:** There is only one Platform Admin. That account cannot remove its own Platform Admin status or override its own protected admin permissions.








## 5. Member Screens

### S1. Login / Signup

Besides “Continue with Google,” what information or actions must appear?

**Answer:** Only the app title appears in addition to the Continue with Google action.

### S2. Home — Groups

What should each group card show? Examples: group name, role, active-order count, next deadline, or member count.

**Answer:** Group name, the user's role, active-order count, next deadline, and member count.

### S3. Home — Restaurants

Should Home show all restaurants, a short preview with “See all,” or restaurant search and filters?

**Answer:** Home shows a short restaurant preview with See all. The complete restaurant page provides filters.

### S4. Home — Active orders

Should urgent active-order actions also appear on Home, or only inside Orders?

**Answer:** Active orders appear on both Home and Orders. Order History appears only on Orders.

### S5. Orders — Sections

Confirm the sections: Active Orders and Order History. Add or remove sections if needed.

**Answer:** Orders contains Active Orders and Order History.

### S6. Orders — Filters

Choose any: group, restaurant, status, date, or another filter.

**Answer:** Orders supports group, restaurant, status, and date filters.

### S7. Orders — Visibility

Should a user see only orders they participated in, or every order in their groups when their role permits it?

**Answer:** A Member sees only orders they participated in. A Manager sees every order in groups where they are a Manager. A Group Owner sees every order in groups they own.

### S8. Favorites — Limit

Keep the existing maximum of three ranked food combinations per restaurant branch, change the limit, or remove the limit?

**Answer:** The default limit is three ranked combinations per restaurant branch. The Platform Admin may change this limit in the admin system.

### S9. Favorites — Restaurant versus branch

Should Favorites group combinations by restaurant only or by exact restaurant branch? 

Recommendation: exact branch because menu items and prices may differ.

**Answer:** Favorites are grouped by exact restaurant branch.

### S10. Favorites — Removal

Should removing a restaurant's Favorites require confirmation before deleting all combinations under it?

Recommendation: yes.

**Answer:** Yes. Removing all Favorites for a restaurant branch requires confirmation.

### S11. Team versus Home Groups

Home and Team both list groups. What is each page's distinct purpose?

Recommendation: Home shows quick group summaries; Team contains full group details and management.

**Answer:** Home shows quick summaries and ongoing orders for groups. Team shows full clickable group cards leading to group details and members.

### S12. Team — Group detail

Besides the owner and member list, what should the group-detail screen show?

**Answer:** Members see the group title, Group Owner, and member list. Managers and Group Owners also see the invitation link or code and group-management actions such as removing members or creating an order.









## 6. Existing Order Workflow

For each current rule, write **Keep** or describe the replacement.

### O1. A Manager or Group Owner creates an order for one group.

**Answer:** Keep.

### O2. The creator explicitly selects participants; group membership alone does not add a user to the order.

**Answer:** Keep. The Manager or Group Owner creating the order explicitly selects its participants.

### O3. The order copies the group's default delivery address, with an optional per-order override.

**Answer:** Keep.

### O4. The Manager chooses an initial restaurant and may disable voting, provide a shortlist, or allow the full catalog.

**Answer:** Keep.

### O5. Selected participants vote; an alternative needs at least 50% of selected-participant votes to win. A tie or insufficient vote keeps the initial restaurant.

**Answer:** Keep.

### O6. After restaurant selection, participants confirm food. A valid Rank 1 Favorite is included automatically if they do not respond.

**Answer:** Keep.

### O7. Missing or unavailable food requires Manager resolution before handoff.

**Answer:** Keep. Only a Manager or Group Owner may resolve another participant's missing food.

### O8. The app creates a food subtotal and copyable handoff, but the Manager manually enters and pays for the order in Grab.

**Answer:** Keep.

### O9. The Manager returns and marks the order Ordered or Cancelled and may upload a receipt.

**Answer:** Keep, including the finalized full-order and member-receipt rules.

### O10. Completed orders remain permanently in history with captured prices and selections.

**Answer:** Keep.

### O11. What should happen when an order deadline passes but the app cannot run its scheduled task?

Examples: Manager resolves it manually, retry automatically, or both.

**Answer:** A Manager or Group Owner resolves the missed deadline manually. Automatic retry is not required.





## 7. Platform Admin Screens

### AS1. Which web-admin pages should remain?

Choose any: Overview, Users and Permissions, Groups, Catalog, Imports, Refresh Queue, Access Requests, Audit Log.

**Answer:** Overview, Users and Permissions, Groups, Catalog, Imports, Refresh Queue, Access Requests, and Audit Log.

### AS2. Does Platform Admin need any mobile-admin screens?

If yes, list the actions that must work on a phone.

**Answer:** Groups, Catalog, Access Requests, and Audit Log.

### AS3. Should Platform Admin be able to open a user's effective-permission details and see which permissions come from roles versus overrides?

Recommendation: yes.

**Answer:** Yes. The effective-permission view separates role permissions from account-wide overrides.

### AS4. Should Platform Admin be able to inspect every group and order for support, or only access and catalog information?

**Answer:** The Platform Admin may inspect every group and every order inside those groups.

## 8. Figma and Platform Coverage

### F1. Should implementation continue in Figma?

If existing, paste its Figma link.

**Answer:** No. Stop Figma work and code the UI directly. The user will review and request corrections in the running app.

### F2. Keep the existing bright emerald Option 1 visual direction?

**Answer:** Keep the existing bright emerald Option 1 visual direction.

### F3. Which screens require separate Figma designs?

Choose one: Android and iPhone separately, one shared mobile design with platform notes, or another approach.

**Answer:** Use one shared mobile design with Android and iPhone PWA platform notes.

### F4. Which screen should be designed and approved first?

**Answer:** Sign in, Home, Orders, Favorites, and Groups, in that order.

### F5. Who gives final design approval?

**Answer:** The user gives final design approval.





## 9. Replacement Implementation Tracker

### T1. Should the next implementation task first migrate from one group to multiple groups before building more catalog or storage features?

Recommendation: yes, because every later order and permission feature depends on it.

**Answer:** Yes. The first bundle migrates the product from one group per user to multiple groups before additional catalog or storage implementation.

### T2. Should completed V1-01 through V1-06 remain as permanent history while the pending task list is replaced?

Recommendation: yes.

**Answer:** Yes. Completed V1-01 through V1-06 remain as permanent history while the pending list is replaced.

### T3. Should the new tasks continue the V1 numbering or start a new numbered plan?

**Answer:** just name the task itself as bundles, show which are sequential and which can be worked on separately

### T4. What is the first complete user journey that must work after the redesign?

Example: Google sign-in → browse restaurants → save Favorite → join multiple groups → view Team.

**Answer:** Google sign-in → browse restaurants → save a Favorite → join multiple groups → view Team.

### T5. Should existing users, roles, invitations, and audit history be preserved during the multi-group migration?

Recommendation: yes.

**Answer:** Yes. Existing users, roles, invitations, and audit history must be preserved during migration.

### T6. What should count as task completion?

Choose any: automated tests, browser verification, Android emulator, physical Android device, iPhone PWA, production verification, or other evidence.

**Answer:** Browser verification for web/PWA tasks and Android emulator verification for native-mobile tasks.

# Security Specification for Ustam

## 1. Data Invariants
- A project must belong to the authenticated user.
- A task, material, or transaction must reference a valid project and must be owned by the user who owns that project.
- No user can read or write another user's projects, tasks, materials, or transactions.
- All monetary amounts (like `allocatedBudget`, `quantity`, `unitPrice`, `totalPrice`, `amount`) must be non-negative.

## 2. The "Dirty Dozen" Malicious Payloads
1. **Identity Spoofing in Projects**: Attempt to create a project with `userId` of another user.
2. **Resource Poisoning (Long ID)**: Injecting 1KB of junk string as a project ID.
3. **Negative Budget Project**: Creating a project with `allocatedBudget` = -15000.
4. **Invalid Project Status**: Starting a project with status "super-active" (invalid enum).
5. **Cross-User Project Access (Get)**: Reading another user's project details using raw document fetches.
6. **Malicious Task Mutation**: Modifying another user's task status to affect their workspace metrics.
7. **Negative Material Price**: Saving material items with negative price quantities.
8. **Invalid Task Priority**: Creating a task with priority "super-urgent" which is outside the valid schema enum.
9. **Zero-Verify Update Field Bypass**: Sending custom role update query containing `{ "role": "admin" }` to self profile without admin permission.
10. **Malicious Transaction Method**: Logging a cash outflow transaction using method "bribe" (unsupported method).
11. **Negative Ledger Transaction Amount**: Injecting integer underflows or negative amounts into the ledger account transactions.
12. **Recursive List Query Scraping**: Designing query requests for projects missing `where('userId', '==', uid)` to fetch all active documents globally.

## 3. Test Runner Definition (Verification Framework)
The standard testing utilizes the SDK local emulator setup. All payloads matching the above lists are verified to return `PERMISSION_DENIED` at the Firestore security boundary.

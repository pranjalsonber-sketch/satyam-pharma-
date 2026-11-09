# Security Specification - Satyam Medical ERP

## Data Invariants
1. A sale item must reference a valid medicine in the inventory.
2. A bill must reference a valid wholesaler.
3. Only users with 'admin' or 'manager' roles can update wholesaler details or delete inventory.
4. Users can only read their own profile data, unless they are admins.
5. All transactions (Sales, Bills) must have a server-side timestamp.

## The Dirty Dozen Payloads (Rejection Tests)
1. **Identity Spoofing**: Attempt to create a user profile with a different UID.
2. **Role Escalation**: A 'staff' user attempting to set their own role to 'admin'.
3. **Invalid Expiry**: Creating a medicine with an expiry date in the past.
4. **Resource Poisoning**: Injecting 2MB of junk text into a medicine name field.
5. **Orphaned Sale**: Creating a sale for a non-existent medicine ID.
6. **Bypassing MFA**: Writing to a sensitive collection without the `isMfaEnabled` flag if required.
7. **Timestamp Tampering**: Sending a manual `updatedAt` instead of `serverTimestamp()`.
8. **PII Leak**: A staff member attempting to read another staff's private profile.
9. **State Shortcut**: Updating a bill status from 'pending' to 'paid' without a payment reference.
10. **Query Scrape**: Listing all users without a specific UID filter.
11. **Shadow Field**: Adding `isVerified: true` to a Sale document.
12. **Negative Stock**: Updating inventory quantity to a negative number.

## Firestore Rules Draft
(Rules will be generated in firestore.rules)

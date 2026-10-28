# RyukManga secure roles function (TablesDB)

This Appwrite Function is the server-side source of truth for owner/admin/moderator badges and owner-defined custom tags. The frontend must not be trusted to authorize role changes.

## Owner identity

Set `OWNER_USER_ID=sobhan` only after confirming that `sobhan` is the exact Appwrite Auth user `$id` for the site owner. User IDs are case-sensitive. The owner is configured on the server and cannot be changed through the request body.

## Database setup

The current implementation uses **TablesDB**, not the older DocumentsDB API.

- Database ID: `ryukmanga_roles_db`
- Table ID: `roles`
- Required column: `role`, Varchar size 16, Required on
- Optional column: `customTag`, Varchar size 32, Required off
- Optional column: `customTagColor`, Varchar size 7, Required off

The function uses each target user's Appwrite user ID as the row ID. The `role` column must allow `member` for accounts that have a custom tag but no staff role. Leave public/client row writes disabled. Do not give browser users direct permission to create, update, or delete role rows.

## Function environment variables

Configure these in Appwrite Function settings:

- `OWNER_USER_ID=sobhan` (only if verified as the exact Auth `$id`)
- `ROLES_DATABASE_ID=ryukmanga_roles_db`
- `ROLES_TABLE_ID=roles`
- `APPWRITE_API_KEY=<secret>` — store as a secret; never commit it or put it in frontend code.
- `APPWRITE_FUNCTION_API_ENDPOINT=https://fra.cloud.appwrite.io/v1` (optional; this is the default)
- `APPWRITE_FUNCTION_PROJECT_ID=6ad28bbc0023dee367ab` (optional; this is the default)

Create a server API key with the minimum scopes needed for reading/writing rows in this database and reading Users to validate target accounts. In Appwrite's current scope names, check for the relevant TablesDB rows read/write permissions and Users read permission. Do not share the key in chat.

Deploy this folder as an Appwrite Function using Node.js. Entrypoint: `src/main.js`. Install dependencies from `package.json`. The function must be configured to accept authenticated executions from signed-in users; it uses Appwrite's server-provided `x-appwrite-user-id` execution header and never trusts a caller ID supplied in JSON.

## API

All actions are POST requests and require an authenticated caller.

- `{ "action": "list" }`: returns stored role/tag assignments and the configured owner badge.
- `{ "action": "grant-admin", "userId": "<Appwrite user ID>" }`: owner only.
- `{ "action": "revoke-admin", "userId": "<Appwrite user ID>" }`: owner only.
- `{ "action": "grant-moderator", "userId": "<Appwrite user ID>" }`: owner only.
- `{ "action": "revoke-moderator", "userId": "<Appwrite user ID>" }`: owner only.
- `{ "action": "set-custom-tag", "userId": "<Appwrite user ID>", "tag": "Translator", "color": "#d4c6ff" }`: owner only; plain text, no icon.
- `{ "action": "remove-custom-tag", "userId": "<Appwrite user ID>" }`: owner only.

The owner can manage staff roles and custom tags. All role-changing actions are checked in the function, not merely hidden in the UI. The role badge UI and management panel are not live until the function is deployed and its ID is configured in the frontend. Test list, grant/revoke, custom-tag set/remove, and rejection from a non-owner account before treating this as production-ready.

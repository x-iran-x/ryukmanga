# RyukManga secure roles function

This function is the server-side source of truth for owner/admin/moderator badges and owner-defined custom tags. It deliberately does **not** use account preferences, because a signed-in user can edit their own preferences.

## Fixed owner

Set `OWNER_USER_ID=sobhan` in the function's environment variables. The function defaults to this value, but configuring it explicitly in Appwrite is recommended. The frontend must never be allowed to override it.

## Appwrite setup required

1. In Appwrite Console, create a Database for site roles (or use a dedicated existing database).
2. Create a collection named `roles` with a required string attribute named `role` (maximum length 16), plus optional string attributes `customTag` (maximum length 32) and `customTagColor` (maximum length 7). Set document security on and do not grant client users create/update/delete permissions. Keep collection/document access restricted; the function uses its server API key.
3. Create an API key with only the database/document read/write scopes for the roles collection plus the Users read scope needed to validate target accounts. Store it as the function secret `APPWRITE_API_KEY`; never put it in browser code or commit it to GitHub.
4. Configure function variables:
   - `OWNER_USER_ID=sobhan`
   - `ROLES_DATABASE_ID=<database ID>`
   - `ROLES_COLLECTION_ID=<roles collection ID>`
   - `APPWRITE_API_KEY=<secret API key>`
   - Optional: `APPWRITE_FUNCTION_API_ENDPOINT=https://fra.cloud.appwrite.io/v1`
   - Optional: `APPWRITE_FUNCTION_PROJECT_ID=6ad28bbc0023dee367ab`
5. Deploy this directory as an Appwrite Function using Node.js and set its entrypoint to `src/main.js`. Install dependencies from `package.json`.
6. Configure the function to accept authenticated executions from signed-in users. The function reads Appwrite's server-provided `x-appwrite-user-id` execution header; it never trusts a caller ID sent in the JSON body.
7. Set the function's execution permissions so signed-in users can read public role badges and call the endpoint. The function itself restricts all POST role changes to the configured owner.

## API

- `POST { "action": "list" }`: returns role assignments, including the configured owner, for a signed-in caller.
- `POST { "action": "grant-admin", "userId": "<Appwrite user ID>" }`: owner only; target account is validated through Appwrite Users API.
- `POST { "action": "revoke-admin", "userId": "<Appwrite user ID>" }`: owner only.
- `POST { "action": "grant-moderator", "userId": "<Appwrite user ID>" }`: owner only; assigns the moderator role.
- `POST { "action": "revoke-moderator", "userId": "<Appwrite user ID>" }`: owner only; removes the moderator role.
- `POST { "action": "set-custom-tag", "userId": "<Appwrite user ID>", "tag": "Translator", "color": "#d4c6ff" }`: owner only; sets a plain-text badge with no icon.
- `POST { "action": "remove-custom-tag", "userId": "<Appwrite user ID>" }`: owner only; removes that user’s custom tag.

Important: create the `role`, `customTag`, and `customTagColor` string attributes and use document IDs equal to Appwrite user IDs. The `role` attribute must allow the value `member`, used for accounts that only have a custom tag. Do not add public write permissions. This function code is a backend component; the badge UI and admin-management interface must be connected to the deployed function before the feature is live.

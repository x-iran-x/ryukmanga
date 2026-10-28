import { Client, TablesDB, Query, Users } from "node-appwrite";

const OWNER_USER_ID = (process.env.OWNER_USER_ID || "sobhan").trim();
const DATABASE_ID = process.env.ROLES_DATABASE_ID;
const TABLE_ID = process.env.ROLES_TABLE_ID || process.env.ROLES_COLLECTION_ID;
const API_KEY = process.env.APPWRITE_API_KEY;

function jsonError(res, status, message) {
  return res.json({ ok: false, error: message }, status);
}

// Appwrite user IDs are identifiers, not usernames: preserve their exact casing.
function normalizeUserId(value) {
  return typeof value === "string" ? value.trim() : "";
}

export default async ({ req, res, log, error }) => {
  try {
    if (!API_KEY || !DATABASE_ID || !TABLE_ID || !OWNER_USER_ID) {
      error("Missing required roles function environment variables.");
      return jsonError(res, 500, "Role service is not configured.");
    }

    const callerId = normalizeUserId(req.headers["x-appwrite-user-id"]);
    if (!callerId) return jsonError(res, 401, "Sign in is required.");

    const client = new Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT || "https://fra.cloud.appwrite.io/v1")
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID || "6ad28bbc0023dee367ab")
      .setKey(API_KEY);
    const tablesDB = new TablesDB(client);
    const users = new Users(client);

    const readRoles = async () => {
      const response = await tablesDB.listRows({
        databaseId: DATABASE_ID,
        tableId: TABLE_ID,
        queries: [Query.limit(100)]
      });
      return response.rows.map((row) => ({
        userId: row.$id,
        role: row.role,
        customTag: typeof row.customTag === "string" ? row.customTag : "",
        customTagColor: typeof row.customTagColor === "string" ? row.customTagColor : ""
      })).filter((item) =>
        item.role === "owner" ||
        item.role === "admin" ||
        item.role === "moderator" ||
        Boolean(item.customTag)
      );
    };

    const method = String(req.method || "GET").toUpperCase();
    const body = req.bodyJson && typeof req.bodyJson === "object" ? req.bodyJson : {};

    if (method !== "POST") return jsonError(res, 405, "Method not allowed.");

    const action = body.action;
    if (action === "list") {
      const roles = await readRoles();
      const publicRoles = roles.filter((item) => item.userId !== OWNER_USER_ID);
      publicRoles.unshift({ userId: OWNER_USER_ID, role: "owner", customTag: "", customTagColor: "" });
      return res.json({ ok: true, roles: publicRoles });
    }

    // Only the configured owner can manage roles and custom tags.
    if (callerId !== OWNER_USER_ID) {
      return jsonError(res, 403, "Only the site owner can manage site roles and custom tags.");
    }

    const targetUserId = normalizeUserId(body.userId);
    if (!targetUserId || targetUserId.length > 36) {
      return jsonError(res, 400, "A valid user ID is required.");
    }
    if (targetUserId === OWNER_USER_ID) {
      return jsonError(res, 400, "The owner's role and custom tag cannot be changed here.");
    }

    const getExisting = async () => tablesDB.getRow({
      databaseId: DATABASE_ID,
      tableId: TABLE_ID,
      rowId: targetUserId
    }).catch((readError) => {
      if (Number(readError?.code) === 404) return null;
      throw readError;
    });

    const createOrUpdate = async (data) => {
      const existing = await getExisting();
      if (existing) {
        return tablesDB.updateRow({
          databaseId: DATABASE_ID,
          tableId: TABLE_ID,
          rowId: targetUserId,
          data
        });
      }
      return tablesDB.createRow({
        databaseId: DATABASE_ID,
        tableId: TABLE_ID,
        rowId: targetUserId,
        data: { role: "member", ...data },
        permissions: []
      });
    };

    const roleActions = {
      "grant-admin": { role: "admin", grant: true },
      "revoke-admin": { role: "admin", grant: false },
      "grant-moderator": { role: "moderator", grant: true },
      "revoke-moderator": { role: "moderator", grant: false }
    };
    const operation = roleActions[action];

    if (operation) {
      if (operation.grant) {
        try {
          await users.get({ userId: targetUserId });
        } catch (userError) {
          if (Number(userError?.code) === 404) {
            return jsonError(res, 404, "No Appwrite account exists with that user ID.");
          }
          throw userError;
        }
        await createOrUpdate({ role: operation.role });
      } else {
        const existing = await getExisting();
        if (existing?.role === operation.role) {
          if (existing.customTag) {
            await tablesDB.updateRow({
              databaseId: DATABASE_ID,
              tableId: TABLE_ID,
              rowId: targetUserId,
              data: { role: "member" }
            });
          } else {
            await tablesDB.deleteRow({
              databaseId: DATABASE_ID,
              tableId: TABLE_ID,
              rowId: targetUserId
            });
          }
        }
      }
      log("Owner " + callerId + " completed " + action + " for " + targetUserId + ".");
      return res.json({ ok: true, action, userId: targetUserId, role: operation.role });
    }

    if (action === "set-custom-tag") {
      try {
        await users.get({ userId: targetUserId });
      } catch (userError) {
        if (Number(userError?.code) === 404) {
          return jsonError(res, 404, "No Appwrite account exists with that user ID.");
        }
        throw userError;
      }

      const tag = typeof body.tag === "string" ? body.tag.trim() : "";
      const color = typeof body.color === "string" ? body.color.trim() : "";
      if (!tag || tag.length > 32) {
        return jsonError(res, 400, "Tag text must be between 1 and 32 characters.");
      }
      if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
        return jsonError(res, 400, "A valid hex color is required.");
      }

      await createOrUpdate({ customTag: tag, customTagColor: color });
      log("Owner " + callerId + " set a custom tag for " + targetUserId + ".");
      return res.json({ ok: true, action, userId: targetUserId, tag, color });
    }

    if (action === "remove-custom-tag") {
      const existing = await getExisting();
      if (existing?.customTag) {
        if (["admin", "moderator"].includes(existing.role)) {
          await tablesDB.updateRow({
            databaseId: DATABASE_ID,
            tableId: TABLE_ID,
            rowId: targetUserId,
            data: { customTag: "", customTagColor: "" }
          });
        } else {
          await tablesDB.deleteRow({
            databaseId: DATABASE_ID,
            tableId: TABLE_ID,
            rowId: targetUserId
          });
        }
      }
      log("Owner " + callerId + " removed a custom tag from " + targetUserId + ".");
      return res.json({ ok: true, action, userId: targetUserId });
    }

    return jsonError(res, 400, "Unknown role action.");
  } catch (err) {
    error(err?.stack || String(err));
    return jsonError(res, 500, "Role operation failed.");
  }
};

import { Client, Databases, Query, Users } from "node-appwrite";

const OWNER_USER_ID = (process.env.OWNER_USER_ID || "sobhan").trim().toLowerCase();
const DATABASE_ID = process.env.ROLES_DATABASE_ID;
const COLLECTION_ID = process.env.ROLES_COLLECTION_ID;
const API_KEY = process.env.APPWRITE_API_KEY;

function jsonError(res, status, message) {
  return res.json({ ok: false, error: message }, status);
}

function normalizeUserId(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export default async ({ req, res, log, error }) => {
  try {
    if (!API_KEY || !DATABASE_ID || !COLLECTION_ID) {
      error("Missing required roles function environment variables.");
      return jsonError(res, 500, "Role service is not configured.");
    }

    const callerId = normalizeUserId(req.headers["x-appwrite-user-id"]);
    if (!callerId) return jsonError(res, 401, "Sign in is required.");

    const client = new Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT || "https://fra.cloud.appwrite.io/v1")
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID || "6ad28bbc0023dee367ab")
      .setKey(API_KEY);
    const databases = new Databases(client);
    const users = new Users(client);

    const readRoles = async () => {
      const response = await databases.listDocuments({
        databaseId: DATABASE_ID,
        collectionId: COLLECTION_ID,
        queries: [Query.limit(100)]
      });
      return response.documents.map((doc) => ({
        userId: doc.$id,
        role: doc.role
      })).filter((item) => item.role === "owner" || item.role === "admin" || item.role === "moderator");
    };

    const method = String(req.method || "GET").toUpperCase();
    const body = req.bodyJson && typeof req.bodyJson === "object" ? req.bodyJson : {};

    if (method !== "POST") return jsonError(res, 405, "Method not allowed.");

    const action = body.action;
    if (action === "list") {
      const roles = await readRoles();
      // The owner is defined by a server-side environment variable, not user-editable profile preferences.
      const publicRoles = roles.filter((item) => item.userId !== OWNER_USER_ID);
      publicRoles.unshift({ userId: OWNER_USER_ID, role: "owner" });
      return res.json({ ok: true, roles: publicRoles });
    }

    // Only the configured owner can grant or revoke admin and moderator roles.
    if (callerId !== OWNER_USER_ID) return jsonError(res, 403, "Only the site owner can manage site roles.");

    const targetUserId = normalizeUserId(body.userId);
    if (!targetUserId || targetUserId.length > 36) {
      return jsonError(res, 400, "A valid user ID is required.");
    }
    if (targetUserId === OWNER_USER_ID) {
      return jsonError(res, 400, "The owner's role cannot be changed here.");
    }
    const roleActions = {
      "grant-admin": { role: "admin", grant: true },
      "revoke-admin": { role: "admin", grant: false },
      "grant-moderator": { role: "moderator", grant: true },
      "revoke-moderator": { role: "moderator", grant: false }
    };
    const operation = roleActions[action];
    if (!operation) return jsonError(res, 400, "Unknown role action.");

    if (operation.grant) {
      try {
        await users.get({ userId: targetUserId });
      } catch {
        return jsonError(res, 404, "No Appwrite account exists with that user ID.");
      }
      try {
        await databases.createDocument({
          databaseId: DATABASE_ID,
          collectionId: COLLECTION_ID,
          documentId: targetUserId,
          data: { role: operation.role },
          permissions: []
        });
      } catch (createError) {
        const existing = await databases.getDocument({
          databaseId: DATABASE_ID,
          collectionId: COLLECTION_ID,
          documentId: targetUserId
        }).catch(() => null);
        if (!existing) throw createError;
        await databases.updateDocument({
          databaseId: DATABASE_ID,
          collectionId: COLLECTION_ID,
          documentId: targetUserId,
          data: { role: operation.role },
          permissions: []
        });
      }
    } else {
      // Avoid removing a different role if the owner picked the wrong revoke action.
      const existing = await databases.getDocument({
        databaseId: DATABASE_ID,
        collectionId: COLLECTION_ID,
        documentId: targetUserId
      }).catch((readError) => {
        if (Number(readError?.code) === 404) return null;
        throw readError;
      });
      if (existing?.role === operation.role) {
        await databases.deleteDocument({
          databaseId: DATABASE_ID,
          collectionId: COLLECTION_ID,
          documentId: targetUserId
        });
      }
    }

    log(`Owner ${callerId} completed ${action} for ${targetUserId}.`);
    return res.json({ ok: true, action, userId: targetUserId, role: operation.role });
  } catch (err) {
    error(err?.stack || String(err));
    return jsonError(res, 500, "Role operation failed.");
  }
};

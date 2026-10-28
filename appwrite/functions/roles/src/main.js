import { Client, Databases, ID, Query } from "node-appwrite";

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

    const readRoles = async () => {
      const response = await databases.listDocuments({
        databaseId: DATABASE_ID,
        collectionId: COLLECTION_ID,
        queries: [Query.limit(100)]
      });
      return response.documents.map((doc) => ({
        userId: doc.$id,
        role: doc.role
      })).filter((item) => item.role === "owner" || item.role === "admin");
    };

    const method = String(req.method || "GET").toUpperCase();
    const body = req.bodyJson && typeof req.bodyJson === "object" ? req.bodyJson : {};

    if (method === "GET") {
      const roles = await readRoles();
      // The owner is defined by a server-side environment variable, not user-editable profile preferences.
      const publicRoles = roles.filter((item) => item.userId !== OWNER_USER_ID);
      publicRoles.unshift({ userId: OWNER_USER_ID, role: "owner" });
      return res.json({ ok: true, roles: publicRoles });
    }

    if (method !== "POST") return jsonError(res, 405, "Method not allowed.");

    // Only the configured owner can grant or revoke administrator roles.
    if (callerId !== OWNER_USER_ID) return jsonError(res, 403, "Only the site owner can manage administrators.");

    const action = body.action;
    const targetUserId = normalizeUserId(body.userId);
    if (!targetUserId || targetUserId.length > 36) {
      return jsonError(res, 400, "A valid user ID is required.");
    }
    if (targetUserId === OWNER_USER_ID) {
      return jsonError(res, 400, "The owner's role cannot be changed here.");
    }
    if (action !== "grant-admin" && action !== "revoke-admin") {
      return jsonError(res, 400, "Unknown role action.");
    }

    if (action === "grant-admin") {
      try {
        await databases.createDocument({
          databaseId: DATABASE_ID,
          collectionId: COLLECTION_ID,
          documentId: targetUserId,
          data: { role: "admin" },
          permissions: []
        });
      } catch (createError) {
        // If a role document already exists, update it to admin. Other errors are rethrown.
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
          data: { role: "admin" },
          permissions: []
        });
      }
    } else {
      await databases.deleteDocument({
        databaseId: DATABASE_ID,
        collectionId: COLLECTION_ID,
        documentId: targetUserId
      }).catch((deleteError) => {
        // Revoking a non-admin is idempotent.
        if (Number(deleteError?.code) !== 404) throw deleteError;
      });
    }

    log(`Owner ${callerId} completed ${action} for ${targetUserId}.`);
    return res.json({ ok: true, action, userId: targetUserId });
  } catch (err) {
    error(err?.stack || String(err));
    return jsonError(res, 500, "Role operation failed.");
  }
};

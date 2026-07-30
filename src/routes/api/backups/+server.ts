import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { statements } from "$lib/db";
import { runBackup } from "$lib/backup-server";

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) {
    throw error(401, "Unauthorized");
  }

  const token = statements.getOAuthToken.get("google");
  const lastBackup = statements.getLastBackup.get();
  const backups = statements.getBackups.all();

  return json({
    configured: !!(token && token.client_id && token.client_secret && token.redirect_uri),
    connected: !!(token && token.refresh_token),
    client_id: token?.client_id || "",
    redirect_uri: token?.redirect_uri || "",
    folder_id: token?.folder_id || "",
    lastBackup: lastBackup || null,
    backups: backups || []
  });
};

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    throw error(401, "Unauthorized");
  }

  const { action, client_id, client_secret, redirect_uri, folder_id } = await request.json();

  if (action === "save_config") {
    if (!client_id || !client_secret || !redirect_uri) {
      throw error(400, "Missing required parameters");
    }
    const existing = statements.getOAuthToken.get("google");

    // A refresh token is only valid for the client it was issued to. If the
    // credentials changed, keeping the old token would fail with invalid_grant
    // on every backup, so discard it and force a fresh authorization.
    const sameClient =
      existing?.client_id === client_id && existing?.client_secret === client_secret;

    statements.setOAuthToken.run(
      "google",
      sameClient ? existing?.access_token || "" : "",
      sameClient ? existing?.refresh_token || null : null,
      sameClient ? existing?.expires_at || null : null,
      client_id,
      client_secret,
      redirect_uri,
      folder_id || null
    );
    return json({ success: true });
  }

  if (action === "trigger_backup") {
    try {
      const fileId = await runBackup();
      const lastBackup = statements.getLastBackup.get();
      return json({ success: true, fileId, lastBackup });
    } catch (err: unknown) {
      const lastBackup = statements.getLastBackup.get();
      return json({
        success: false,
        error: err instanceof Error ? err.message : String(err),
        lastBackup
      });
    }
  }

  if (action === "disconnect") {
    statements.deleteOAuthToken.run("google");
    return json({ success: true });
  }

  throw error(400, "Invalid action");
};

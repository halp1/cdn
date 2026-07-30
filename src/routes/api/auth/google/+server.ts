import { error, redirect, json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { statements } from "$lib/db";

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    throw error(401, "Unauthorized");
  }

  const { client_id, client_secret, redirect_uri, folder_id } = await request.json();
  if (!client_id || !client_secret || !redirect_uri) {
    throw error(400, "Missing required parameters");
  }

  const existing = statements.getOAuthToken.get("google");

  // Tokens are bound to the client they were issued for — drop them if the
  // credentials changed rather than letting a stale refresh token linger.
  const sameClient = existing?.client_id === client_id && existing?.client_secret === client_secret;
  const access_token = sameClient ? (existing?.access_token ?? "") : "";
  const refresh_token = sameClient ? (existing?.refresh_token ?? null) : null;
  const expires_at = sameClient ? (existing?.expires_at ?? null) : null;

  statements.setOAuthToken.run(
    "google",
    access_token,
    refresh_token,
    expires_at,
    client_id,
    client_secret,
    redirect_uri,
    folder_id || null
  );

  const scope = "https://www.googleapis.com/auth/drive.file";
  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(client_id)}` +
    `&redirect_uri=${encodeURIComponent(redirect_uri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(scope)}` +
    `&access_type=offline` +
    `&prompt=consent`;

  return json({ url: authUrl });
};

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) {
    throw error(401, "Unauthorized");
  }

  const config = statements.getOAuthToken.get("google");
  if (!config || !config.client_id || !config.redirect_uri) {
    throw error(400, "Google Drive Backup is not configured yet.");
  }

  const scope = "https://www.googleapis.com/auth/drive.file";
  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(config.client_id)}` +
    `&redirect_uri=${encodeURIComponent(config.redirect_uri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(scope)}` +
    `&access_type=offline` +
    `&prompt=consent`;

  throw redirect(302, authUrl);
};

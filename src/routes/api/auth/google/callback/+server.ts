import { error, redirect } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { statements } from "$lib/db";

export const GET: RequestHandler = async ({ url }) => {
  const code = url.searchParams.get("code");
  const err = url.searchParams.get("error");

  if (err) {
    throw redirect(302, `/?backup_error=${encodeURIComponent(err)}`);
  }

  if (!code) {
    throw error(400, "Missing authorization code");
  }

  const config = statements.getOAuthToken.get("google");
  if (!config || !config.client_id || !config.client_secret || !config.redirect_uri) {
    throw error(400, "OAuth configuration not found in database.");
  }

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        code,
        client_id: config.client_id,
        client_secret: config.client_secret,
        redirect_uri: config.redirect_uri,
        grant_type: "authorization_code"
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error_description || errorData.error || "Failed to exchange code for token"
      );
    }

    const data = await response.json();
    const access_token = data.access_token;
    const refresh_token = data.refresh_token || config.refresh_token;
    const expires_in = data.expires_in || 3600;
    const expires_at = Math.floor(Date.now() / 1000) + expires_in;

    statements.setOAuthToken.run(
      "google",
      access_token,
      refresh_token,
      expires_at,
      config.client_id,
      config.client_secret,
      config.redirect_uri,
      config.folder_id
    );

    throw redirect(302, "/?backup_connected=true");
  } catch (e: unknown) {
    if (e && typeof e === "object" && "status" in e && e.status === 302) {
      throw e;
    }
    const msg = e instanceof Error ? e.message : "OAuth exchange failed";
    throw redirect(
      302,
      `/?backup_error=${encodeURIComponent(msg)}`
    );
  }
};

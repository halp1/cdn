import { statements } from "$lib/db";
import { zipSync } from "fflate";
import fs from "fs";

/**
 * Wipes the stored tokens but keeps the OAuth config (client id/secret/redirect/folder)
 * so the UI drops back to the "not connected" state and the user can re-authorize
 * without re-entering everything.
 */
export function clearGoogleTokens(): void {
  const token = statements.getOAuthToken.get("google");
  if (!token) return;

  statements.setOAuthToken.run(
    "google",
    "",
    null,
    null,
    token.client_id,
    token.client_secret,
    token.redirect_uri,
    token.folder_id
  );
}

export async function getValidAccessToken(): Promise<string> {
  const token = statements.getOAuthToken.get("google");
  if (!token || !token.access_token) {
    throw new Error("Google Drive is not connected");
  }

  const now = Math.floor(Date.now() / 1000);
  if (!token.expires_at || token.expires_at <= now + 300) {
    if (!token.refresh_token) {
      throw new Error("No refresh token available. Please reconnect Google Drive.");
    }
    if (!token.client_id || !token.client_secret) {
      throw new Error("Missing Client ID or Client Secret in configuration.");
    }

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        client_id: token.client_id,
        client_secret: token.client_secret,
        refresh_token: token.refresh_token,
        grant_type: "refresh_token"
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      let errCode = "";
      try {
        errCode = JSON.parse(errText).error || "";
      } catch {
        // Non-JSON error body; fall through to the generic message below.
      }

      // invalid_grant means Google will never accept this refresh token again:
      // it was revoked, the credentials it was issued for changed, or the app is
      // still in "Testing" publishing status (those refresh tokens expire after 7
      // days). Retrying is pointless, so drop it and ask for a fresh authorization.
      if (errCode === "invalid_grant") {
        clearGoogleTokens();
        throw new Error(
          "Google rejected the saved refresh token (invalid_grant). This happens when access " +
            "was revoked, the OAuth credentials changed, or the Google Cloud app is still in " +
            "'Testing' publishing status (refresh tokens expire after 7 days there). " +
            "Reconnect Google Drive to authorize again."
        );
      }

      throw new Error(`Failed to refresh access token: ${errText}`);
    }

    const data = await response.json();
    const new_access_token = data.access_token;
    const expires_in = data.expires_in || 3600;
    const new_expires_at = Math.floor(Date.now() / 1000) + expires_in;

    statements.setOAuthToken.run(
      "google",
      new_access_token,
      token.refresh_token,
      new_expires_at,
      token.client_id,
      token.client_secret,
      token.redirect_uri,
      token.folder_id
    );

    return new_access_token;
  }

  return token.access_token;
}

export async function runBackup(): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000);
  try {
    const accessToken = await getValidAccessToken();
    const tokenRecord = statements.getOAuthToken.get("google");
    const folder_id = tokenRecord?.folder_id || null;

    if (!fs.existsSync("data/app.db")) {
      throw new Error("Database file 'data/app.db' not found");
    }

    const dbBuffer = fs.readFileSync("data/app.db");
    const zipContent = zipSync(
      {
        "app.db": new Uint8Array(dbBuffer)
      },
      { level: 9 }
    );

    const metadata = {
      name: `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.zip`,
      mimeType: "application/zip",
      parents: folder_id ? [folder_id] : undefined
    };

    const boundary = "314159265358979323846";
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const bodyParts: (string | Uint8Array)[] = [
      delimiter,
      `Content-Type: application/json; charset=UTF-8\r\n\r\n`,
      JSON.stringify(metadata),
      delimiter,
      `Content-Type: application/zip\r\n\r\n`,
      zipContent,
      closeDelimiter
    ];

    const totalLength = bodyParts.reduce((acc: number, val) => {
      if (typeof val === "string") {
        return acc + Buffer.byteLength(val);
      } else {
        return acc + val.byteLength;
      }
    }, 0);

    const multipartBody = new Uint8Array(totalLength);
    let offset = 0;
    const textEncoder = new TextEncoder();
    for (const part of bodyParts) {
      if (typeof part === "string") {
        const encoded = textEncoder.encode(part);
        multipartBody.set(encoded, offset);
        offset += encoded.byteLength;
      } else {
        multipartBody.set(part, offset);
        offset += part.byteLength;
      }
    }

    const uploadResponse = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": multipartBody.byteLength.toString()
        },
        body: multipartBody
      }
    );

    if (!uploadResponse.ok) {
      const errText = await uploadResponse.text();
      throw new Error(`Google Drive Upload failed: ${errText}`);
    }

    const uploadData = await uploadResponse.json();
    const drive_file_id = uploadData.id;

    statements.createBackup.run(timestamp, "success", null, drive_file_id);
    return drive_file_id;
  } catch (err: unknown) {
    const error_message = err instanceof Error ? err.message : String(err);
    statements.createBackup.run(timestamp, "failed", error_message, null);
    throw err;
  }
}

let schedulerInterval: NodeJS.Timeout | undefined;

export function startBackupScheduler() {
  if (schedulerInterval) return;

  // Run scheduler every 4 hours (4 * 60 * 60 * 1000)
  const INTERVAL_MS = 4 * 60 * 60 * 1000;

  schedulerInterval = setInterval(async () => {
    try {
      const token = statements.getOAuthToken.get("google");
      if (token && token.refresh_token) {
        console.log("[Backup Scheduler] Triggering Google Drive backup...");
        await runBackup();
        console.log("[Backup Scheduler] Backup completed successfully.");
      }
    } catch (e) {
      console.error("[Backup Scheduler] Scheduled backup failed:", e);
    }
  }, INTERVAL_MS);

  // Unref interval to allow process to exit cleanly if needed
  if (schedulerInterval && typeof schedulerInterval.unref === "function") {
    schedulerInterval.unref();
  }

  console.log("[Backup Scheduler] Google Drive Backup scheduler started (interval: 4 hours).");
}

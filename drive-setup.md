To set up the Google Drive Backup, follow these simple steps:

### Step 1: Create Google Cloud Credentials
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (or select an existing one).
3. In the sidebar, navigate to **APIs & Services** > **Library**. Search for **Google Drive API** and enable it.
4. Navigate to **APIs & Services** > **OAuth consent screen**:
   - Choose **External** user type.
   - Fill in your App name and developer contact email.
   - Under **Scopes**, click **Add or Remove Scopes**, and add the scope: `.../auth/drive.file` (this scope allows the app to upload/manage only its own backups safely).
   - Under **Test users**, add your own Google email address.
5. Navigate to **APIs & Services** > **Credentials**:
   - Click **+ Create Credentials** > **OAuth client ID**.
   - Select **Web application** as the application type.
   - Under **Authorized redirect URIs**, add your application's callback URL. For local development, this is:
     ```
     http://localhost:5173/api/auth/google/callback
     ```
     *(If running in production, use `https://your-domain.com/api/auth/google/callback`)*.
6. Click **Create** and copy your **Client ID** and **Client Secret**.

---

### Step 2: Configure in HCDN UI
1. Open the HCDN web interface and log in.
2. In the top bar, click the **Cloud Icon** (Google Drive Backup button) next to the Storage Stats button. The backup panel will expand on the right side.
3. Paste the credentials you retrieved from Google:
   - **Client ID**: Paste your Client ID.
   - **Client Secret**: Paste your Client Secret.
   - **Redirect URI**: Verify it matches exactly the Redirect URI you entered in Google Cloud Console (e.g. `http://localhost:5173/api/auth/google/callback`).
   - **Google Drive Folder ID (Optional)**: If you want backups saved in a specific folder, create a folder in your Google Drive, copy its ID from the URL bar (the string of characters after `/folders/`), and paste it here. If left blank, it will back up to your root Google Drive folder.
4. Click **Connect Google Drive**.

---

### Step 3: Complete Google Authorization
1. You will be redirected to Google's authentication page.
2. Select your Google account and grant the app permission to access Google Drive (since the app is not verified by Google yet, you may need to click *Advanced* > *Go to your-app (unsafe)* to proceed).
3. Once authorized, you will automatically be redirected back to HCDN.

---

### Step 4: Verify and Run Backups
- You will see a green **Connected** badge in the Google Drive Backup panel.
- Click **Backup Database Now** to run an immediate manual backup and test that everything works.
- The new backup will appear in the **Backup History** list with its success status.
- A **Green Status Dot** and "Backup: [time]" indicator will display in your top bar, showing the latest backup time.
- Automated backups will now trigger silently in the background every **4 hours**.
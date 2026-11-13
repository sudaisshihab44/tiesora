# Google Sign-In Setup

The app already contains the Google button and callback handling. The button
appears automatically when Supabase reports the Google provider as enabled.
No `VITE_*` secret is needed.

## 1. Create the Google OAuth client

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Select or create a project (for example `Tiesora`).
3. Go to **APIs & Services → OAuth consent screen**.
   - User type: **External**
   - App name: `Tiesora`
   - Support email: your email
   - Developer contact: your email
   - Scopes: `openid`, `email`, `profile`
   - While testing, add your own Google account under **Test users**.
4. Go to **APIs & Services → Credentials**.
5. Click **Create credentials → OAuth client ID**.
6. Application type: **Web application**.
7. Add these values:

   **Authorized JavaScript origins**
   ```
   https://<project-ref>.supabase.co
   https://<your-production-domain>
   http://localhost:3000
   ```

   **Authorized redirect URI**
   ```
   https://<project-ref>.supabase.co/auth/v1/callback
   ```

   Replace `<project-ref>` with your Supabase project ref
   (`yuysjdytkofnblusdtvu` for this project).

8. Click **Create** and copy the **Client ID** and **Client Secret**.

## 2. Enable Google in Supabase

1. Supabase Dashboard → **Authentication → Providers → Google**.
2. Toggle **Enable Google**.
3. Paste the Client ID and Client Secret.
4. Save.

Alternatively, once you have the values, they can be applied through the
Supabase Management API. Do not paste secrets into source files or `VITE_*`
variables.

## 3. Confirm URLs

Supabase Dashboard → **Authentication → URL Configuration**:

- **Site URL**: your production URL, e.g.
  `https://tiesora-sudais-projects-70d52462.vercel.app/`
- **Redirect URLs**:
  ```
  https://<your-production-domain>/**
  http://localhost:3000/**
  http://127.0.0.1:3000/**
  ```

The project already has production and localhost entries; keep them.

## 4. Test

1. Sign out and open **Sign In**.
2. Choose Admin or User, then click **Continue with Google**.
3. Choose a Google account.
4. A new Google user with no family goes to the onboarding choice.
5. An existing Google user goes to their family dashboard.

The app reads `GET /auth/v1/settings` and only shows the button when
`external.google === true`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Button does not appear | Provider not enabled, or settings request failed. Hard-refresh after enabling. |
| `redirect_uri_mismatch` | The Google redirect URI must be exactly `https://<project-ref>.supabase.co/auth/v1/callback`. |
| Login loops back to landing | Add the app origin to Supabase Redirect URLs. |
| New Google user sees an empty dashboard | They have no family yet; use **Create a Family** or an invitation link. |
| “Unsupported provider” | Google is not enabled in Supabase Authentication → Providers. |

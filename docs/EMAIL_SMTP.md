# Email Verification & SMTP Setup

Supabase currently has **email auto-confirm ON** and **no custom SMTP** on this
project. That means signup is instant, but verification and password-reset email
delivery are not production-grade. Use one of the options below.

## Option A — Supabase default mailer (testing only)

1. Supabase Dashboard → **Authentication → Sign In / Providers → Email**.
2. Turn **Confirm email** ON.
3. Keep the default sender for now.
4. Test with a real inbox you control.

Supabase's shared mailer is rate-limited and not intended for production. Use it
only to verify the flow.

## Option B — Custom SMTP (recommended)

Pick a provider: Resend, SendGrid, Mailgun, Amazon SES, Brevo, or Gmail SMTP.
You need:

- SMTP host
- SMTP port (usually 465 for SSL or 587 for STARTTLS)
- SMTP username
- SMTP password / API key
- Sender email (e.g. `noreply@yourdomain.com`)
- Sender name (e.g. `Tiesora`)

### Gmail SMTP (small-scale testing)

1. Enable 2-Step Verification on the Google account.
2. Google Account → **Security → App passwords** → create one for “Mail”.
3. Use:
   - Host: `smtp.gmail.com`
   - Port: `465`
   - Username: the Gmail address
   - Password: the 16-character app password
   - Sender: the Gmail address

Gmail limits daily sending; use a transactional provider for a real launch.

### Enter the SMTP settings in Supabase

1. Supabase Dashboard → **Project Settings → Authentication → SMTP Settings**.
2. Enable custom SMTP.
3. Fill in host, port, username, password, sender email, sender name.
4. Save.
5. Go to **Authentication → Sign In / Providers → Email** and turn
   **Confirm email** ON.
6. Set **Secure email change** ON if you want both old and new addresses to
   confirm.

### Email templates

Supabase Dashboard → **Authentication → Email Templates**:

- Confirm signup
- Magic link
- Recovery
- Invite user
- Change email address

Keep `{{ .ConfirmationURL }}` in each template. Brand the subject and body as
Tiesora. The recovery template must link to the app; the app accepts both
`#reset-password` and Supabase's `type=recovery` hash.

### Redirect URLs

Supabase Dashboard → **Authentication → URL Configuration**:

```
https://<your-production-domain>/**
http://localhost:3000/**
http://127.0.0.1:3000/**
```

## Verification checklist

1. Sign up with a real inbox → receive the confirmation email.
2. Click the link → app opens, user is confirmed.
3. Sign in → onboarding or dashboard appears.
4. Use **Forgot password** → receive the reset email.
5. Open the reset link → set a new password → sign in with it.
6. Confirm the sender is not landing in spam; add SPF/DKIM records at your
   provider/domain if needed.

## Current app behaviour

- With confirmation OFF (current state), signup goes straight to onboarding.
- With confirmation ON, signup shows the “check your inbox” screen and supports
  resending the confirmation email.
- Password reset uses `resetPasswordForEmail` with a redirect to
  `/#reset-password`; the reset form updates the password through Supabase.
- Invite links are preserved across confirmation/OAuth redirects in
  `localStorage` and consumed after sign-in.

## Troubleshooting

| Symptom | Fix |
|---|---|
| No email arrives | Check spam, SMTP credentials, sender domain verification, and Supabase Auth logs. |
| “Email not confirmed” | Confirm the user in Authentication → Users, or click the email link. |
| Reset link opens the landing page | Add the app origin to Redirect URLs. |
| Reset link says expired | Links are single-use and time-limited; request a new one. |
| Emails rate-limited | Default Supabase mailer limit; configure custom SMTP. |

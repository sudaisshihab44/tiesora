# Supabase Email Configuration Guide for Tiesora

## Overview

This guide explains how to configure Supabase email settings for Tiesora's authentication and invitation system.

**IMPORTANT**: Tiesora invitation links are **generated and shared manually** (copy/paste). Supabase handles ONLY authentication emails (signup confirmation, password reset). Custom invitation emails would require a separate email service.

---

## 1. Required Supabase Dashboard Configuration

### Step 1: Access Email Settings

1. Open your Supabase project: https://supabase.com/dashboard/project/yuysjdytkofnblusdtvu
2. Navigate to: **Authentication → Email Templates**
3. Navigate to: **Authentication → URL Configuration**

### Step 2: Configure Site URL (CRITICAL)

**Location**: Authentication → URL Configuration → Site URL

**Development**:
```
http://localhost:3000
```

**Production** (MUST UPDATE BEFORE DEPLOYING):
```
https://your-production-domain.com
```

⚠️ **This must match your deployed domain exactly** - Supabase uses this for email verification links.

### Step 3: Configure Redirect URLs

**Location**: Authentication → URL Configuration → Redirect URLs

Add these URLs (replace with your actual domains):

**Development**:
- `http://localhost:3000/**`
- `http://127.0.0.1:3000/**`

**Production**:
- `https://your-production-domain.com/**`

### Step 4: Email Confirmation Settings

**Location**: Authentication → Providers → Email

**Recommended Settings**:

- ✅ **Enable Email Confirmation**: ON (for production)
- ✅ **Enable Email Signup**: ON
- ✅ **Double Confirm Email Changes**: ON (recommended)
- ✅ **Secure Email Change**: ON (recommended)

**For Development/Testing**:
- You MAY disable email confirmation temporarily to speed up testing
- Re-enable before production deployment

---

## 2. Email Templates

Supabase provides three default email templates you should customize:

### A. Confirmation Email (Signup Verification)

**When sent**: When a new user signs up via `SignUpPage`

**Default variables available**:
- `{{ .ConfirmationURL }}` - Link to verify email
- `{{ .Token }}` - Verification token
- `{{ .SiteURL }}` - Your site URL

**Customization**:
1. Go to: Authentication → Email Templates → **Confirm signup**
2. Customize the template to match Tiesora branding
3. Use Tiesora colors: #285C43 (emerald), #FAF9F6 (background)

**Example snippet**:
```html
<p>Welcome to Tiesora!</p>
<p>Click the link below to verify your email and start building your family tree:</p>
<a href="{{ .ConfirmationURL }}">Verify Email Address</a>
```

### B. Password Reset Email

**When sent**: When user requests password reset from `SignInPage`

**Customization**:
1. Go to: Authentication → Email Templates → **Reset password**
2. Customize with Tiesora branding

**Example snippet**:
```html
<p>You requested to reset your Tiesora password.</p>
<p>Click the link below to set a new password:</p>
<a href="{{ .ConfirmationURL }}">Reset Password</a>
```

### C. Email Change Confirmation

**When sent**: When user changes their email address

**Customization**:
1. Go to: Authentication → Email Templates → **Change email address**
2. Customize as needed

---

## 3. Environment Variable Configuration

Ensure your `.env` file has the correct app URL:

**Development** (`.env`):
```bash
VITE_APP_URL=http://localhost:3000
```

**Production** (set via Vercel/hosting dashboard):
```bash
VITE_APP_URL=https://your-production-domain.com
```

⚠️ **DO NOT** include trailing slashes

---

## 4. Invitation System (Manual Link Sharing)

### How Tiesora Invitations Work

1. **Admin creates invitation** via User Management page
2. **System generates secure token** (server-side with pgcrypto)
3. **Invitation link is displayed** in the UI
4. **Admin copies and manually shares** the link (email, WhatsApp, SMS, etc.)
5. **Recipient clicks link** → AcceptInvitationPage → Signs up or signs in → Joins family

### Invitation Link Format

```
https://your-domain.com/#invite=TOKEN
```

**Example**:
```
https://tiesora.com/#invite=abc123xyz-456def
```

### Important Notes

- ✅ Tokens are generated server-side (secure)
- ✅ Tokens expire after 7 days (configurable)
- ✅ Single-use tokens (marked as accepted after first use)
- ✅ Role comes from invitation (server-side), not from URL
- ❌ NO automatic email delivery (admin must share manually)

---

## 5. Optional: Custom SMTP Configuration

If you want to use a custom email provider instead of Supabase's default:

### Supported Providers
- SendGrid
- AWS SES
- Postmark
- Mailgun
- Custom SMTP

### Configuration Steps

1. Go to: **Project Settings → Auth → SMTP Settings**
2. Enable custom SMTP
3. Enter your SMTP credentials:
   - Host: `smtp.yourdomain.com`
   - Port: `587` (TLS) or `465` (SSL)
   - Username: Your SMTP username
   - Password: Your SMTP password
   - Sender email: `noreply@yourdomain.com`
   - Sender name: `Tiesora`

---

## 6. Testing Email Delivery

### Test Signup Confirmation

1. Start dev server: `npm run dev`
2. Navigate to: http://localhost:3000
3. Click "Sign Up"
4. Enter test email address
5. Check email inbox for confirmation link
6. Click link to verify

**If email doesn't arrive**:
- Check Supabase logs: Dashboard → Logs → Edge Function Logs
- Check spam/junk folder
- Verify Site URL is correct
- Ensure email provider (Gmail, etc.) isn't blocking

### Test Password Reset

1. Go to Sign In page
2. Click "Forgot password?"
3. Enter your email
4. Check inbox for reset link
5. Click link and set new password

---

## 7. Production Deployment Checklist

Before deploying to production:

- [ ] Update Supabase Site URL to production domain
- [ ] Add production domain to Redirect URLs
- [ ] Enable Email Confirmation (if disabled for dev)
- [ ] Customize email templates with production branding
- [ ] Set `VITE_APP_URL` environment variable in hosting platform
- [ ] Test signup flow end-to-end
- [ ] Test password reset flow
- [ ] Test invitation link generation (verify it uses production URL)
- [ ] Verify email deliverability with real email addresses
- [ ] Set up SPF/DKIM records for custom SMTP (if using)

---

## 8. Common Issues & Troubleshooting

### Issue: Emails not being delivered

**Solutions**:
1. Check Supabase logs for errors
2. Verify Site URL matches exactly
3. Check email provider's spam filters
4. Ensure SMTP credentials are correct (if using custom SMTP)
5. Try different email provider (Gmail, Outlook, etc.)

### Issue: Email links redirect to wrong domain

**Cause**: Site URL is incorrect

**Solution**: 
- Update Site URL in Supabase dashboard
- Ensure `VITE_APP_URL` matches deployed domain
- Clear browser cache and test again

### Issue: Invitation links use localhost instead of production URL

**Cause**: `VITE_APP_URL` not set correctly

**Solution**:
- Set environment variable in hosting platform (Vercel, Netlify, etc.)
- Redeploy application
- Generate new invitation link to verify

### Issue: Email confirmation required but can't receive emails

**Temporary workaround for development**:
1. Disable email confirmation in Supabase dashboard
2. Sign up as normal (no email verification needed)
3. Re-enable before production

---

## 9. Future Enhancement: Automated Invitation Emails

If you want to add automated invitation email delivery:

### Option A: Supabase Edge Functions

1. Create edge function: `supabase/functions/send-invitation-email`
2. Use Supabase's built-in email sending
3. Call from `createInvitation()` in auth.ts

### Option B: Third-Party Email Service

1. Choose provider (SendGrid, Resend, etc.)
2. Add API key to environment variables
3. Create email service: `src/services/email.ts`
4. Call from `createInvitation()` to send invitation

**Template example**:
```
Subject: You're invited to join [Family Name] on Tiesora

Hi [Recipient Name],

[Admin Name] has invited you to join their family tree on Tiesora as a [Role].

Click here to accept: [Invitation Link]

This invitation expires in 7 days.

Best regards,
The Tiesora Team
```

---

## 10. Security Best Practices

- ✅ Always use HTTPS in production
- ✅ Enable email confirmation for production
- ✅ Use secure, random tokens (already implemented with pgcrypto)
- ✅ Set reasonable token expiry (7 days default)
- ✅ Validate tokens server-side (already implemented)
- ✅ Use RLS policies to protect invitation table
- ✅ Log invitation creation and acceptance
- ❌ Never expose Supabase service_role key in frontend
- ❌ Never send passwords via email
- ❌ Never trust client-provided role values

---

## Support

For Supabase-specific issues:
- Docs: https://supabase.com/docs/guides/auth
- Support: https://supabase.com/dashboard/support

For Tiesora-specific issues:
- Check application logs
- Review this documentation
- Contact development team

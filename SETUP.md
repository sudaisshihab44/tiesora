# Tiesora — Setup Guide

## Quick Start (Demo Mode — no backend needed)

```bash
npm install
npm run dev
```

Open http://localhost:3000. The app runs entirely on `localStorage` with sample family data preloaded. Any email/password combination works for sign-in.

## Production Setup (with Supabase)

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your **Project URL** and **anon public key** from: Dashboard → Settings → API

### 2. Run the Database Migration

1. Go to: Dashboard → SQL Editor
2. Copy the entire contents of `supabase/migrations/20261023_init_kinroots.sql`
3. Paste into the SQL Editor and click **Run**

This creates:
- 11 tables (profiles, families, family_memberships, family_people, relationships, invitations, change_requests, memories, events, notifications, audit_logs)
- A `family-photos` storage bucket
- Row Level Security (RLS) policies on every table
- An auto-trigger that creates a profile row when a user signs up
- `updated_at` triggers on all relevant tables
- A `get_user_family_role()` helper function for RLS

### 3. Configure Environment Variables

Copy `.env.example` to `.env` and fill in:

```env
VITE_SUPABASE_URL="https://your-project-ref.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key-here"
VITE_GEMINI_API_KEY="your-gemini-api-key-here"
```

**Never commit `.env` to git.** The `.gitignore` already excludes it.
**Never put the service_role key in frontend code.** Only the anon key is safe — RLS enforces all access control.

### 4. Configure Auth Settings (Supabase Dashboard)

1. Go to: Dashboard → Authentication → Providers
2. Enable **Email** provider
3. Under URL Redirects, add `http://localhost:3000` (and your production URL)
4. Optionally disable "Confirm email" for development under Settings → Auth

### 5. Run the App

```bash
npm install
npm run dev
```

The app will now use real Supabase authentication and database. New users can sign up, create family trees, and invite relatives.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | For Supabase | Project URL from Supabase dashboard |
| `VITE_SUPABASE_ANON_KEY` | For Supabase | Anon public key (safe for frontend) |
| `VITE_GEMINI_API_KEY` | For AI Assistant | Google Gemini API key |
| `VITE_APP_URL` | Optional | App URL for redirects |

## Available Commands

```bash
npm run dev      # Start dev server (port 3000)
npm run build    # Production build
npm run lint     # TypeScript type-check
npm run test     # Relationship engine test suite (17 tests)
npm run preview  # Preview production build
```

## Architecture Notes

- **Demo mode**: When Supabase env vars are not set, the app runs entirely on `localStorage` with seed sample data. All features work offline.
- **Supabase mode**: When `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set, the app uses real Supabase Auth + the database schema from the migration file.
- **RLS**: Every table has Row Level Security policies. Users can only access data in families where they have an active membership. Role hierarchy: owner > admin > editor > contributor > viewer.
- **Invitations**: Generated as `/#invite=TOKEN` links. The app parses the token on load and opens the auth modal. After sign-up/in, the token is validated and a membership is created.

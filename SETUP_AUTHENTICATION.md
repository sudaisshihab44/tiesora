# Tiesora Authentication Setup Guide

This guide will help you set up and test the authentication system properly.

---

## Step 1: Apply Database Migrations

### Option A: Run Complete Setup (Recommended)

1. Open Supabase Dashboard:
   ```
   https://supabase.com/dashboard/project/yuysjdytkofnblusdtvu
   ```

2. Navigate to: **SQL Editor**

3. Copy and paste the **entire contents** of:
   ```
   supabase/migrations/APPLY_TO_SUPABASE.sql
   ```

4. Click **RUN**

5. Wait for success message (should take 5-10 seconds)

This creates:
- 11 tables (profiles, families, family_memberships, etc.)
- All RLS policies
- Helper functions (get_user_family_role, create_family_with_admin, etc.)
- Storage buckets

### Option B: Run Individual Migrations (Alternative)

If the complete setup fails, run migrations one by one **in this exact order**:

1. `20261023_init_kinroots.sql` - Initial schema
2. `20261026_admin_viewer_roles.sql` - Two-role system
3. `20261027_fix_rls_and_bootstrap.sql` - RLS fixes
4. `20261028_invitation_rpcs.sql` - Invitation system
5. `20261029_create_family_with_admin.sql` - Family creation
6. `20261030_create_invitation_rpc.sql` - Create invitation RPC
7. `20261031_fix_validate_invitation_ambiguity.sql` - Invitation fixes

### Verification

Run this in SQL Editor to verify setup:

```sql
-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('profiles', 'families', 'family_memberships', 'invitations')
ORDER BY table_name;

-- Expected: 4 rows

-- Check RPC functions exist
SELECT proname 
FROM pg_proc 
WHERE proname IN (
  'create_family_with_admin',
  'create_invitation',
  'validate_invitation',
  'accept_invitation',
  'get_user_family_role'
)
ORDER BY proname;

-- Expected: 5 rows

-- Check role constraint
SELECT pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'family_memberships'::regclass 
AND conname = 'family_memberships_role_check';

-- Expected: CHECK ((role = ANY (ARRAY['admin'::text, 'viewer'::text])))
```

If all queries return expected results, ✅ **migrations are applied correctly**.

---

## Step 2: Create Test Family and Users

### Method 1: Through the App (Recommended)

1. **Clear browser storage**:
   - Open DevTools (F12)
   - Go to Application > Storage > Clear site data
   - Close and reopen browser

2. **Sign up as admin**:
   - Go to http://localhost:3000
   - Click "Sign up"
   - Email: `admin@tiesora.test`
   - Password: `TestAdmin123!`
   - Name: `Admin User`
   - Click "Create Account"

3. **Complete onboarding**:
   - Choose "Create a Family"
   - Family name: "Test Family"
   - Add first member (yourself or ancestor)
   - Complete wizard

4. **Verify admin access**:
   - You should land on **Dashboard** with full controls
   - Check for "User Management" tab
   - Try adding a family member (should work)

### Method 2: Direct Database Insert

If sign-up doesn't work, create users manually:

```sql
-- First, sign up through Supabase Auth UI or app to create auth.users record
-- Then add membership:

-- Get the user's auth ID
SELECT id, email FROM auth.users WHERE email = 'admin@tiesora.test';
-- Copy the id (UUID)

-- Create a family
INSERT INTO families (id, name, owner_id, privacy_settings)
VALUES (
  gen_random_uuid(),  -- Copy this UUID for next step
  'Test Family',
  '<user_id_from_above>',
  '{"hideLivingDates": false, "hideLivingBiographies": false, "hidePrivateMemories": false, "requireAdminApprovalForEdits": true, "isPubliclySearchable": false}'::jsonb
)
RETURNING id;

-- Create admin membership
INSERT INTO family_memberships (family_id, user_id, user_email, user_name, role, status)
VALUES (
  '<family_id_from_above>',
  '<user_id_from_above>',
  'admin@tiesora.test',
  'Admin User',
  'admin',
  'active'
);
```

---

## Step 3: Test Admin Login

1. **Go to login page**: http://localhost:3000

2. **Select "Admin Login"**

3. **Enter credentials**:
   - Email: `admin@tiesora.test`
   - Password: `TestAdmin123!`

4. **Expected behavior**:
   ```
   Sign in → DB verifies role = 'admin' → Redirect to /dashboard
   ```

5. **Verify admin features**:
   - [ ] Dashboard shows management options
   - [ ] "User Management" tab visible
   - [ ] Can add family members
   - [ ] Can edit relationships
   - [ ] Can send invitations

6. **Check browser console** (F12):
   ```javascript
   // Should show no errors
   // You can manually verify role:
   localStorage.getItem('tiesora_auth_v1')
   ```

---

## Step 4: Create and Test Viewer User

### Create Invitation

1. **As admin**, go to "User Management"

2. **Click "Invite Family Member"**

3. **Enter**:
   - Email: `viewer@tiesora.test`
   - Role: **Viewer**
   - Expiration: 7 days

4. **Copy the invitation link** (should look like):
   ```
   http://localhost:3000/#invite=abc123xyz...
   ```

### Accept Invitation

1. **Open incognito window** (or different browser)

2. **Paste invitation link**

3. **Sign up**:
   - Email: `viewer@tiesora.test`
   - Password: `TestViewer123!`
   - Name: `Viewer User`

4. **Expected behavior**:
   ```
   Sign up → Accept invitation → DB creates membership with role='viewer'
   → Redirect to /dashboard (ViewerDashboard)
   ```

5. **Verify viewer restrictions**:
   - [ ] ViewerDashboard shown (read-only banner)
   - [ ] NO "User Management" tab
   - [ ] NO "Add Member" buttons
   - [ ] CAN view family tree
   - [ ] CAN view memories
   - [ ] CAN explore relationships

### Test Viewer Cannot Elevate

1. **Sign out viewer**

2. **Go to login, select "Admin Login"**

3. **Enter viewer credentials**

4. **Expected behavior**:
   ```
   Sign in → DB verifies role = 'viewer' (not admin)
   → Mismatch screen shown
   → "You selected Admin Login but have Viewer access"
   → Continue as Viewer button
   ```

5. ✅ **This proves role verification works correctly**

---

## Step 5: Test Password Reset

1. **Sign out**

2. **Click "Forgot password?"**

3. **Enter admin email**

4. **Check email** (Supabase sends from noreply@mail.app.supabase.io)

5. **Click reset link**

6. **Should redirect to**:
   ```
   http://localhost:3000/#type=recovery&access_token=...
   ```

7. **Enter new password**

8. **Sign in with new password**

---

## Troubleshooting

### Issue: "Invalid credentials" on sign-in

**Cause**: User doesn't exist in `auth.users`

**Fix**: Sign up first, then sign in

### Issue: Redirected to "Create or Join Family" after sign-in

**Cause**: User has no `family_memberships` row

**Diagnosis**:
```sql
-- Check if membership exists
SELECT * FROM family_memberships fm
JOIN profiles p ON p.id = fm.user_id
WHERE p.email = 'your_email@example.com';
```

**Fix**: 
- Complete onboarding (create family), OR
- Accept an invitation, OR
- Manually insert membership (see Step 2, Method 2)

### Issue: "Admin Login" but redirected to viewer dashboard

**Diagnosis**: Role in database is 'viewer', not 'admin'

**Verification**:
```sql
SELECT fm.role, fm.status 
FROM family_memberships fm
JOIN profiles p ON p.id = fm.user_id
WHERE p.email = 'your_email@example.com';
```

**Fix**: Update role in database (admin action):
```sql
UPDATE family_memberships
SET role = 'admin'
WHERE user_id = (SELECT id FROM profiles WHERE email = 'your_email@example.com');
```

### Issue: RLS policy error on family creation

**Error**: `new row violates row-level security policy`

**Cause**: `create_family_with_admin` RPC not installed

**Fix**: Run migration:
```bash
supabase/migrations/20261029_create_family_with_admin.sql
```

### Issue: "Function does not exist"

**Error**: `function public.create_family_with_admin(...) does not exist`

**Cause**: Migrations not applied

**Fix**: Run Step 1 (Apply Database Migrations)

### Issue: Browser shows old cached data

**Fix**:
1. Open DevTools (F12)
2. Application > Storage > Clear site data
3. Hard refresh (Ctrl+Shift+R / Cmd+Shift+R)
4. Sign in again

---

## Verification Checklist

After setup, verify the complete system:

### Database
- [ ] All 11 tables exist
- [ ] RLS enabled on all tables
- [ ] 5 RPC functions exist
- [ ] Role constraint allows only 'admin'/'viewer'
- [ ] At least 1 family exists
- [ ] At least 1 admin membership exists

### Admin User
- [ ] Can sign in
- [ ] Lands on Dashboard
- [ ] Sees "User Management" tab
- [ ] Can add family members
- [ ] Can create invitations
- [ ] `getRoleFromDB()` returns 'admin'

### Viewer User
- [ ] Can sign in
- [ ] Lands on ViewerDashboard
- [ ] NO "User Management" tab
- [ ] CANNOT add/edit members
- [ ] CAN view tree
- [ ] Selecting "Admin Login" shows mismatch screen
- [ ] `getRoleFromDB()` returns 'viewer'

### Security
- [ ] Viewer cannot access `/admin/*` routes
- [ ] Viewer cannot call admin-only mutations
- [ ] RLS blocks unauthorized writes
- [ ] Role is always verified from database
- [ ] Client cannot elevate their own role

---

## Success Criteria

✅ **Authentication system is working when**:

1. Admin can sign in and manage family
2. Viewer can sign in and browse (read-only)
3. Role verification prevents privilege escalation
4. Invitations create correct memberships
5. Password reset flow works
6. Sessions persist after browser refresh
7. RLS policies enforce security

---

## Next Steps

Once authentication is verified:

1. **Deploy to Vercel**:
   - Push code to GitHub
   - Import to Vercel
   - Add environment variables
   - Update Supabase auth URLs

2. **Production Testing**:
   - Test with real email addresses
   - Verify email confirmation flow
   - Test across devices
   - Load test with multiple users

3. **User Documentation**:
   - Create onboarding guide
   - Document admin workflows
   - Document viewer features
   - Create troubleshooting guide

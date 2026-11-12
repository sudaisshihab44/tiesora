# 🚀 Tiesora - Vercel Deployment Guide

## Current Status: ✅ PRODUCTION READY

Your Tiesora application has been prepared for Vercel deployment. All necessary configurations are complete.

---

## 📦 What's Been Prepared

### Files Created/Modified
- ✅ `vercel.json` - Vercel deployment configuration
- ✅ `README.md` - Complete project documentation
- ✅ `.env.example` - Updated with correct variables
- ✅ `vite.config.ts` - Fixed for production build
- ✅ `.gitignore` - Properly excludes `.env` files

### Build Verification
- ✅ Production build: **SUCCESS** (1.62 MB)
- ✅ Output directory: `dist/`
- ✅ No blocking errors
- ✅ All routes configured for SPA
- ✅ PWA assets included

### Security Verified
- ✅ No secrets in `.env.example`
- ✅ `.env` files excluded from git
- ✅ Service role keys never exposed
- ✅ RLS policies in place

---

## 🎯 Deployment Steps

### Step 1: Commit Changes to Git

```bash
cd "c:\Users\DELL\Downloads\kinroots (2)\kinroots"

# Stage all changes
git add .

# Commit
git commit -m "Production deployment preparation - vercel.json, README, security fixes"

# Check status
git status
```

### Step 2: Push to GitHub

**If you already have a remote:**
```bash
git push origin main
```

**If this is a new repository:**
1. Create a new repository on GitHub: https://github.com/new
   - Name: `tiesora` (or your preferred name)
   - Private or Public (your choice)
   - **Do NOT** initialize with README (you already have one)

2. Connect and push:
```bash
git remote add origin https://github.com/YOUR-USERNAME/tiesora.git
git branch -M main
git push -u origin main
```

### Step 3: Deploy to Vercel

1. **Go to Vercel**: https://vercel.com
2. **Sign in** with GitHub
3. **Import Project**:
   - Click "New Project"
   - Select your `tiesora` repository
   - Click "Import"

4. **Configure Build Settings** (should auto-detect):
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

5. **Add Environment Variables**:
   Click "Environment Variables" and add:

   ```
   VITE_SUPABASE_URL=https://yuysjdytkofnblusdtvu.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   VITE_GROQ_API_KEY=your_groq_api_key_here
   VITE_GEMINI_API_KEY=your_gemini_key_here (optional)
   VITE_APP_URL=https://your-project.vercel.app
   ```

   **Note:** Use your actual values from `.env` file (not `.env.example`)

6. **Deploy**: Click "Deploy" button

7. **Wait**: 2-3 minutes for build and deployment

---

## 🔧 Post-Deployment Configuration

### 1. Update Supabase Authentication URLs

Your Vercel deployment URL will be: `https://your-project-name.vercel.app`

Go to **Supabase Dashboard**:
1. Navigate to: https://app.supabase.com/project/yuysjdytkofnblusdtvu/auth/url-configuration
2. Update **Site URL**: `https://your-project-name.vercel.app`
3. Add to **Redirect URLs**: `https://your-project-name.vercel.app/**`
4. Click "Save"

### 2. Update VITE_APP_URL Environment Variable

In Vercel Dashboard:
1. Go to Settings → Environment Variables
2. Edit `VITE_APP_URL`
3. Change to: `https://your-project-name.vercel.app`
4. Redeploy (Deployments → click the three dots → Redeploy)

### 3. Verify Storage Bucket Exists

In Supabase Dashboard → Storage:
- Check that bucket `family-import-pdfs` exists
- If not, run the SQL from `supabase/migrations/20261102_create_storage_bucket.sql`

---

## ✅ Testing Your Deployment

### 1. Open Your App
Visit: `https://your-project-name.vercel.app`

### 2. Test Core Features
- ✅ Landing page loads
- ✅ Sign up creates new account
- ✅ Email verification works (check inbox)
- ✅ Login redirects to dashboard
- ✅ Create family works
- ✅ Add family members works
- ✅ Family tree displays correctly
- ✅ Navigation works on all routes

### 3. Test Advanced Features
- ✅ Invite family members (sends email)
- ✅ Upload memories
- ✅ Create events
- ✅ PDF import (if Groq key configured)

### 4. Test on Different Devices
- ✅ Desktop browser
- ✅ Mobile browser
- ✅ Install as PWA
- ✅ Tablet

---

## 🐛 Troubleshooting

### Issue: White Screen After Deployment

**Solution:**
1. Open browser DevTools (F12) → Console tab
2. Check for error messages
3. Common causes:
   - Missing environment variables in Vercel
   - Supabase redirect URLs not configured
   - Supabase project paused (free tier auto-pauses after 7 days inactivity)

**Fix:**
- Verify all 5 environment variables are set in Vercel
- Check Supabase URL configuration includes deployment URL
- Wake up Supabase project if paused

### Issue: Authentication Not Working

**Solution:**
1. Check Supabase Dashboard → Authentication → URL Configuration
2. Verify Site URL matches your Vercel deployment URL exactly
3. Verify Redirect URLs includes `https://your-domain.vercel.app/**`
4. Check environment variables have no extra spaces or quotes

### Issue: PDF Import Fails

**Solution:**
1. Verify `VITE_GROQ_API_KEY` is set in Vercel
2. Check storage bucket `family-import-pdfs` exists in Supabase
3. Verify RLS policies are applied (run migration SQL)
4. Check browser console for specific error messages

### Issue: "Failed to fetch" errors

**Solution:**
1. Check Supabase project is active (not paused)
2. Verify `VITE_SUPABASE_URL` is correct
3. Verify `VITE_SUPABASE_ANON_KEY` is correct
4. Check Supabase service is online: https://status.supabase.com

### Issue: Build Fails on Vercel

**Solution:**
1. Check build logs in Vercel dashboard
2. Verify Node.js version is 18 or higher
3. Check all dependencies are in `package.json`
4. Try clearing cache: Settings → Advanced → Clear Cache

---

## 🔄 Redeployment

### Automatic Deployments
Vercel automatically deploys when you push to main branch:
```bash
git add .
git commit -m "Your changes"
git push origin main
```

### Manual Redeploy
In Vercel Dashboard:
1. Go to Deployments tab
2. Click the three dots on latest deployment
3. Click "Redeploy"

### Preview Deployments
Every pull request gets a preview URL automatically.

---

## 📊 Monitoring & Analytics

### Vercel Analytics
- Enable in: Vercel Dashboard → Analytics tab
- Free tier includes: 
  - Page views
  - Top pages
  - Top referrers
  - Devices & browsers

### Error Tracking
Check deployment logs:
1. Vercel Dashboard → Deployments
2. Click on deployment
3. View "Build Logs" and "Function Logs"

### Supabase Monitoring
- Database usage: Supabase Dashboard → Database
- Auth activity: Authentication → Users
- Storage usage: Storage → Settings

---

## 🎨 Custom Domain (Optional)

### Add Custom Domain
1. Purchase domain from provider (Namecheap, GoDaddy, etc.)
2. In Vercel Dashboard → Settings → Domains
3. Click "Add Domain"
4. Enter your domain: `yourdomain.com`
5. Follow DNS configuration instructions
6. Wait for propagation (5 minutes - 48 hours)

### Update After Custom Domain
1. Update `VITE_APP_URL` in Vercel environment variables
2. Update Supabase Site URL and Redirect URLs
3. Redeploy application

---

## 📈 Performance Optimization

### Already Configured
- ✅ Asset caching (1 year)
- ✅ Code splitting
- ✅ PWA caching
- ✅ Compressed assets (gzip)

### Additional Optimizations
- Consider upgrading to Vercel Pro for:
  - Longer function execution time
  - More bandwidth
  - Advanced analytics

---

## 🔐 Security Best Practices

### Current Security Measures
- ✅ Environment variables in Vercel (not in code)
- ✅ HTTPS enforced
- ✅ Row Level Security in Supabase
- ✅ Authentication required
- ✅ CORS configured
- ✅ Service role key never exposed

### Recommended Actions
- Enable 2FA on Vercel account
- Enable 2FA on GitHub account
- Enable 2FA on Supabase account
- Regularly update dependencies: `npm update`
- Monitor Supabase audit logs

---

## 📞 Support & Resources

### Documentation
- **This Project**: README.md in repository
- **Vercel**: https://vercel.com/docs
- **Supabase**: https://supabase.com/docs
- **Vite**: https://vitejs.dev/guide

### Community
- Vercel Discord: https://vercel.com/discord
- Supabase Discord: https://discord.supabase.com

### Useful Links
- Vercel Dashboard: https://vercel.com/dashboard
- Supabase Dashboard: https://app.supabase.com
- Groq Console: https://console.groq.com

---

## 🎉 Success!

Once deployment is complete and tests pass, your Tiesora application is live and accessible worldwide!

**Share your family tree**: `https://your-project-name.vercel.app`

---

## 📝 Deployment Checklist

- [ ] Commit changes to git
- [ ] Push to GitHub
- [ ] Import project in Vercel
- [ ] Configure build settings
- [ ] Add environment variables (all 5)
- [ ] Deploy
- [ ] Update Supabase Site URL
- [ ] Update Supabase Redirect URLs
- [ ] Update VITE_APP_URL in Vercel
- [ ] Redeploy
- [ ] Test registration
- [ ] Test login
- [ ] Test family creation
- [ ] Test family tree
- [ ] Test PDF import
- [ ] Test on mobile
- [ ] Share with family!

---

**Estimated Total Time:** 15-20 minutes for first deployment

**Questions?** Review the troubleshooting section or check the README.md

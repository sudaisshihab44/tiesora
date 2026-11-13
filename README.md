# Tiesora — Family Tree & Relationship Platform

**Every family. Every connection. Every story.**

Tiesora is a modern, beautifully designed family tree application that helps you build your genealogy, discover relationships between relatives, and preserve family memories for generations.

![Tiesora](https://images.unsplash.com/photo-1511895426328-dc8714191300?w=1200&h=400&fit=crop)

## ✨ Features

- **Interactive Family Tree** — Visual family tree with drag-to-pan canvas
- **Relationship Explorer** — Discover complex relationships between any two family members
- **Memory Timeline** — Upload and organize family photos and stories
- **Event Calendar** — Track birthdays, anniversaries, and reunions
- **PDF Import** — AI-powered extraction of family data from genealogy documents
- **Collaboration** — Invite family members with admin or viewer roles
- **Data Privacy** — Row-level security ensures families only see their own data
- **PWA Support** — Install as a mobile or desktop app
- **Multi-generation Support** — Track ancestors and descendants across generations
- **Change Requests** — Viewers can suggest edits for admin approval

## 🚀 Tech Stack

- **Frontend**: React 19 + TypeScript + Vite 8
- **Styling**: Tailwind CSS 4 + Motion animations
- **Authentication**: Supabase Auth
- **Database**: Supabase (PostgreSQL with RLS)
- **AI**: Groq API (openai/gpt-oss-120b) for PDF extraction
- **File Storage**: Supabase Storage
- **Deployment**: Vercel

## 📋 Prerequisites

- Node.js 18 or higher
- npm or bun package manager
- Supabase account (free tier works)
- Groq API key (for PDF import feature)

## 🛠️ Local Development Setup

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd kinroots
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Fill in your environment variables:

```env
# Supabase Configuration (required)
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Groq AI for PDF Import (required for PDF feature)
VITE_GROQ_API_KEY=your_groq_api_key

# Gemini AI (optional fallback)
VITE_GEMINI_API_KEY=your_gemini_api_key

# App URL (auto-configured in production)
VITE_APP_URL=http://localhost:3000
```

#### Getting API Keys:

**Supabase:**
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Go to Settings → API
4. Copy the URL and anon/public key

**Groq:**
1. Go to [console.groq.com](https://console.groq.com)
2. Sign up and create an API key
3. Copy the key starting with `gsk_`

### 4. Set up Supabase Database

Run the migration SQL scripts in your Supabase SQL Editor:

```sql
-- Run these files in order:
-- 1. supabase/migrations/20261023_init_kinroots.sql
-- 2. supabase/migrations/20261026_admin_viewer_roles.sql
-- 3. supabase/migrations/20261027_fix_rls_and_bootstrap.sql
-- 4. supabase/migrations/20261101_pdf_import_system.sql
-- 5. supabase/migrations/20261102_create_storage_bucket.sql
```

Or use the combined file:
```sql
-- supabase/migrations/APPLY_TO_SUPABASE.sql
```

### 5. Create Storage Bucket

In Supabase Dashboard → Storage:
1. Click "New bucket"
2. Name: `family-import-pdfs`
3. Public: No (private)
4. Click "Create bucket"

Or run the SQL from `20261102_create_storage_bucket.sql`

### 6. Start development server

```bash
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000)

## 🌐 Deployment to Vercel

### Prerequisites
- GitHub account
- Vercel account (free tier works)
- All environment variables ready

### Steps

1. **Push your code to GitHub**

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-github-repo-url>
git push -u origin main
```

2. **Connect to Vercel**

- Go to [vercel.com](https://vercel.com)
- Click "New Project"
- Import your GitHub repository
- Vercel will auto-detect the Vite configuration

3. **Configure Build Settings**

Vercel should auto-configure these, but verify:
- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

4. **Add Environment Variables**

In Vercel Dashboard → Settings → Environment Variables, add:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GROQ_API_KEY=your_groq_api_key
VITE_GEMINI_API_KEY=your_gemini_api_key (optional)
VITE_APP_URL=https://your-domain.vercel.app
```

5. **Deploy**

Click "Deploy" and wait for the build to complete.

6. **Update Supabase Auth Settings**

In Supabase Dashboard → Authentication → URL Configuration:
- Add your Vercel URL to **Site URL**: `https://your-domain.vercel.app`
- Add your Vercel URL to **Redirect URLs**: `https://your-domain.vercel.app/**`

### Custom Domain (Optional)

In Vercel → Settings → Domains:
1. Click "Add Domain"
2. Enter your custom domain
3. Configure DNS as instructed
4. Update `VITE_APP_URL` environment variable
5. Update Supabase auth URLs

## 📁 Project Structure

```
kinroots/
├── public/              # Static assets
├── src/
│   ├── components/      # React components
│   │   ├── admin/       # Admin-only components
│   │   ├── auth/        # Authentication pages
│   │   ├── collaboration/ # Collaboration features
│   │   ├── common/      # Shared components
│   │   ├── dashboard/   # Dashboard views
│   │   ├── events/      # Events page
│   │   ├── import/      # PDF import review
│   │   ├── landing/     # Public landing page
│   │   ├── memories/    # Memories timeline
│   │   ├── profile/     # Person profile drawer
│   │   ├── relationships/ # Relationship explorer
│   │   ├── settings/    # Settings page
│   │   └── tree/        # Family tree canvas
│   ├── services/        # API and data services
│   │   ├── auth.ts      # Supabase authentication
│   │   ├── storage.ts   # LocalStorage + Supabase sync
│   │   ├── supabase.ts  # Supabase client
│   │   ├── aiExtractor.ts # PDF AI extraction
│   │   └── pdfProcessor.ts # PDF text extraction
│   ├── types/           # TypeScript types
│   ├── utils/           # Utility functions
│   ├── App.tsx          # Main app component
│   └── main.tsx         # Entry point
├── supabase/            # Database migrations
├── .env.example         # Environment template
├── vercel.json          # Vercel configuration
├── vite.config.ts       # Vite configuration
└── package.json         # Dependencies
```

## 🎨 Brand Colors

- **Forest Green**: `#285C43` (Primary)
- **Dark Green**: `#193D2D` (Accent)
- **Sage**: `#E7F0E8` (Light background)
- **Warm Ivory**: `#FAF9F6` (Cards)
- **White**: `#FFFFFF` (Base)

## 🔒 Security

- **Row Level Security (RLS)**: Families can only access their own data
- **Role-based Access**: Admin and Viewer roles with granular permissions
- **Secure Authentication**: Email verification and password reset via Supabase
- **No Service Keys in Frontend**: All sensitive operations use anon key + RLS
- **HTTPS Only**: Enforced in production

## 👥 User Roles

### Admin
- Full access to family data
- Add, edit, delete family members
- Manage relationships
- Upload memories and create events
- Invite new family members
- Approve viewer change requests
- Access settings and collaboration features

### Viewer
- Read-only access to family tree
- View family members and relationships
- View memories and events
- Submit change requests for admin approval
- Cannot modify data directly

## 📱 PWA Features

Tiesora is a Progressive Web App that can be installed:
- **Desktop**: Chrome, Edge, Safari (Add to Dock)
- **Android**: Chrome (Add to Home Screen)
- **iOS**: Safari (Add to Home Screen)

## 🐛 Troubleshooting

### Build fails with TypeScript errors
The project has non-blocking TypeScript errors in `ImportReviewDashboard.tsx`. These don't prevent the build from succeeding. Run:
```bash
npm run build
```
If it completes successfully, you can deploy.

### White screen after deployment
1. Check browser console for errors
2. Verify environment variables are set in Vercel
3. Check Supabase auth URLs include your deployment URL
4. Clear browser cache and hard refresh

### PDF import not working
1. Verify `VITE_GROQ_API_KEY` is set
2. Check storage bucket `family-import-pdfs` exists in Supabase
3. Verify RLS policies are applied (run migration SQL)

### Authentication issues
1. Check Supabase project is not paused (free tier auto-pauses after 1 week inactivity)
2. Verify Site URL and Redirect URLs in Supabase auth settings
3. Check email confirmation settings match your workflow

## 📄 License

Private project. All rights reserved.

## 🤝 Contributing

This is a private family application. Contact the repository owner for collaboration.

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Supabase documentation
3. Check Vercel deployment logs
4. Contact the development team

---

Built with ❤️ for families everywhere.

# MatibabuOS - Pharmacy Patient Ledger (MVP)

A multi-tenant patient ledger system for small African pharmacies to replace paper notebooks.

## 🎯 Mission
Instant patient lookup (<2s) + Auto-calculated balances (zero math errors).
Security + Data Integrity > Feature Completeness.

## 🛠️ Tech Stack
- **Frontend:** Next.js 14 (App Router), Tailwind CSS, Lucide React
- **Backend:** Supabase (Postgres, Auth, RLS)
- **Hosting:** Vercel
- **Language:** TypeScript (Strict)

## 🚀 Setup

### Prerequisites
- Node.js 18+
- Supabase account

### Supabase Configuration

#### 1. Create Supabase Project
- Go to [Supabase](https://app.supabase.com/) and create a new project
- Note your project URL and anon key

#### 2. Run Database Migrations
- In Supabase dashboard, go to SQL Editor
- Run the migration file: `supabase/migrations/001_initial_schema.sql`
- This creates all necessary tables, views, and RLS policies

#### 3. Configure Authentication (Critical for Local Development)

**For Local Development:**
1. Go to **Authentication → URL Configuration**
2. Set **Site URL** to `http://localhost:3000`
3. Set **Redirect URLs** to `http://localhost:3000/**`
4. Add **Additional Redirects**: `http://localhost:3000/auth/callback`
5. Save changes

**Testing Shortcut (Local Dev Only):**
- Go to **Authentication → Settings**
- Toggle OFF "Enable email confirmations" for instant sign-in
- ⚠️ Remember to re-enable for production

### Environment Variables
Create a `.env.local` file in the root directory:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

> ⚠️ **Important:** `NEXT_PUBLIC_SUPABASE_URL` should be your Supabase cloud endpoint (e.g., `https://xyz.supabase.co`), NOT `localhost`. Only the redirect URLs in the dashboard reference `localhost:3000`.

### Installation
1. Clone the repository
2. Install dependencies: `npm install`
3. Run the development server: `npm run dev`

### Troubleshooting Auth Issues

**Magic link fails with "expired" or "access_denied":**
- Clear browser storage: `localStorage.clear(); sessionStorage.clear();`
- Verify `http://localhost:3000/**` is in Redirect URLs (with wildcard)
- Ensure `http://localhost:3000/auth/callback` is explicitly added

**No confirmation emails received:**
- Check spam folder
- Verify email provider is configured in Supabase (Settings → Email)
- For local testing, disable email confirmations as described above

**Redirects to wrong page after login:**
- Check that your `Site URL` matches your development URL
- Verify the callback route exists at `/auth/callback`

## 🧠 Key Features
- Multi-tenant architecture with Row Level Security
- Phone number normalization for Kenyan numbers
- Signed transactions (dispense/payments)
- Automatic balance calculation
- Audit trail for all transactions
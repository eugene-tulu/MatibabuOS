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

### Environment Variables
Create a `.env.local` file in the root directory:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### Installation
1. Clone the repository
2. Install dependencies: `npm install`
3. Run the development server: `npm run dev`

## 🧠 Key Features
- Multi-tenant architecture with Row Level Security
- Phone number normalization for Kenyan numbers
- Signed transactions (dispense/payments)
- Automatic balance calculation
- Audit trail for all transactions
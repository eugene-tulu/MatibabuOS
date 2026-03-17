# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Supabase email/password authentication with optional magic link sign-in
- Auth page for sign up and sign in flows
- Create clinic page wired to Supabase `clinics` and `user_clinics` tables
- Clinic navbar with simple clinic switcher dropdown
- Active clinic session syncing between React context, localStorage, and cookies
- Initial project setup for MatibabuOS MVP
- Database schema for multi-tenant patient ledger system
- Clinics, patients, and transactions tables
- User-clinic junction table for role-based access
- SQL views for calculating patient balances
- Row Level Security (RLS) policies for data isolation
- Phone normalization utilities
- Audit trail with created_by fields
- README.md with setup instructions
- CHANGELOG.md for tracking changes
- Phone number normalization utility with validation
- Simple test function for phone utilities
- Package.json with project dependencies
- Next.js configuration files (next.config.js, tsconfig.json)
- Application layout and routing structure
- Main page with patient search functionality
- Onboarding page for clinic creation
- Patient detail page with transaction history
- Clinic context for managing active clinic
- Supabase client utility for database operations
- Global styles with Tailwind CSS
- Tailwind CSS configuration
- PostCSS configuration
- API route for phone normalization
- Session validation utilities for clinic access verification
- User clinic retrieval functions
- Middleware for route protection
- Debounced patient search on the main dashboard (phone-only MVP)
- Patient search result preview card (name, phone, balance, last visit) with deep link to patient detail
- "Add New Patient" flow that pre-fills the searched phone number

### Changed
- Moved phone normalization logic to phoneUtils.ts with additional validation
- Added comprehensive test function for phone normalization
- Clinic context now loads clinics from Supabase and validates active clinics against `user_clinics`
- Onboarding flow now redirects new users without clinics to the create clinic page
- Middleware now protects routes using Supabase auth and active clinic validation
- Patient balances view extended to include `last_visit` for faster preview rendering
 
### Performance
- Patient search uses a 300ms debounce and cancels in-flight queries on new input
- Added `console.time('patient_search')` timing for end-to-end search latency

### Fixed
- Handled clinic name uniqueness conflicts with user-friendly error messages
- Improved feedback for permission denied and offline network scenarios during onboarding and auth flows
- Patient search now shows dedicated offline/permission/server error states with retry

### Security
- Implemented RLS policies to ensure users only see their clinic's data
- Added unique constraints on clinic names to prevent conflicts
- Enforced foreign key relationships for data integrity
- Added database migration file with proper schema and constraints
- Added session validation to ensure users only access authorized clinics
- Updated Next.js to version 14.2.35 to patch critical security vulnerabilities
- Fixed critical middleware vulnerability: Added user_clinics validation to prevent unauthorized clinic access
- Updated Supabase to version 2.45.4 for proper abort signal support

### Fixed
- Bug 1: Fixed Supabase client initialization to handle missing environment variables gracefully. The client now uses a getter function that throws a helpful error instead of crashing at import time.
  - Updated all files to use `getSupabase()` instead of direct `supabase` import:
    - src/contexts/ClinicContext.tsx
    - app/onboarding/page.tsx
    - app/components/Navbar.tsx
    - app/create-clinic/page.tsx
    - app/page.tsx
    - app/patient/new/page.tsx
    - app/patient/[id]/page.tsx
    - app/auth/page.tsx
    - middleware.ts
    - src/utils/sessionValidation.ts
    - app/auth/callback/route.ts
  - Fixed ClinicContext interface to correctly reflect that refreshClinics returns Clinic[]
- Bug 2: Fixed abort controller race condition in patient detail page. Added proper cleanup and request tracking to prevent loading state issues when activeClinicId changes.
- Bug 3: Fixed authentication flow:
  - Created `/auth/callback` route to handle email confirmation and magic link verification
  - Updated auth page to include proper redirect URLs for both email/password and magic link flows
  - Fixed email confirmation detection to use `email_confirmed_at` instead of `identities.length`
  - Added emailRedirectTo option to magic link for proper callback handling

### Changed
- Improved phone validation consistency by using isValidKenyanPhone utility
- Added abort controller cleanup on component unmount to prevent memory leaks
- Enhanced duplicate patient error handling with specific user feedback
- Updated error handling patterns for better user experience

### Fixed
- Fixed TypeScript errors in middleware by properly scoping user variable
- Removed @ts-expect-error by updating Supabase package version
# Database Schema & Migration Guide

This directory contains the complete SQL schema and migration scripts for the MatibabuOS pharmacy patient ledger system.

## 📁 File Structure

```
supabase/
├── migrations/
│   ├── 001_master_schema.sql    ← Run once on fresh project
│   ├── 002_test_data.sql        ← Optional: local dev testing
│   ├── 003_debug_helpers.sql    ← Optional: troubleshooting
│   └── 004_migration_template.sql ← Reference for future changes
└── README.md                    ← This file
```

## 🚀 Quick Start

### 1. Fresh Supabase Project

1. Create a new Supabase project
2. Open the SQL Editor
3. Run the entire contents of `001_master_schema.sql`
4. (Optional) Run `002_test_data.sql` for local development

### 2. Verify Installation

After running the master schema, execute these checks:

```sql
-- Verify RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- Verify policies exist
SELECT polname, polrelid::regclass AS table_name
FROM pg_policy
WHERE polrelid::regclass::text IN ('clinics', 'user_clinics', 'patients', 'transactions');

-- Verify trigger exists
SELECT trigger_name FROM information_schema.triggers
WHERE event_object_table = 'clinics';

-- Verify view permissions
SELECT table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'authenticated' AND table_name = 'patient_balances';
```

## ⚠️ Critical Frontend Rules

### 1. Clinic Creation

**DO NOT** manually insert into `user_clinics` after creating a clinic. The trigger handles ownership automatically.

```typescript
// ✅ CORRECT: Let the trigger handle ownership
const { data: clinic } = await supabase
  .from('clinics')
  .insert({ name: clinicName })
  .select()
  .single();
// Trigger automatically adds you as owner

// ❌ WRONG: Manual insert causes 409 Conflict
await supabase.from('user_clinics').insert({
  clinic_id: clinic.id,
  user_id: user.id,
  role: 'owner'
});
```

### 2. Patient/Transaction Inserts

**ALWAYS** include `clinic_id` in inserts, and ensure it matches `activeClinicId`:

```typescript
// ✅ CORRECT
await supabase.from('patients').insert({
  name,
  phone,
  clinic_id: activeClinicId, // ← Critical
  notes
});

// ❌ WRONG: Missing clinic_id → RLS violation
await supabase.from('patients').insert({ name, phone });
```

### 3. Balance Queries

**USE** the `patient_balances` view for balance display (never calculate client-side):

```typescript
// ✅ CORRECT
const { data } = await supabase
  .from('patient_balances')
  .select('*')
  .eq('patient_id', patientId)
  .eq('clinic_id', activeClinicId)
  .single();

// ❌ WRONG: Client-side calculation (prone to errors)
const balance = transactions.reduce((sum, t) => sum + t.amount, 0);
```

## 🔧 Troubleshooting

### Issue: "relation 'patient_balances' does not exist"

**Solution**: Run `001_master_schema.sql` to create the view.

### Issue: "permission denied for relation user_clinics"

**Solution**: Ensure RLS policies are created. Run:
```sql
SELECT * FROM pg_policy WHERE polrelid::regclass::text = 'user_clinics';
```

### Issue: `auth.uid()` returns NULL

Some Supabase configurations require using JWT claims directly. If policies fail, replace all `auth.uid()` references with:

```sql
NULLIF(current_setting('request.jwt.claims.sub', true), '')::uuid
```

Test which works:
```sql
SELECT
  auth.uid() AS uid_result,
  NULLIF(current_setting('request.jwt.claims.sub', true), '')::uuid AS jwt_result;
```

### Issue: Clinic creation doesn't auto-assign owner

Check the trigger exists:
```sql
SELECT * FROM information_schema.triggers WHERE event_object_table = 'clinics';
```

If missing, re-run the trigger section from `001_master_schema.sql`.

## 📊 Schema Overview

### Core Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `clinics` | Tenant/container | `id`, `name`, `created_by` |
| `user_clinics` | User-role mapping | `user_id`, `clinic_id`, `role` |
| `patients` | Patient records | `id`, `clinic_id`, `name`, `phone` |
| `transactions` | Financial ledger | `id`, `patient_id`, `clinic_id`, `amount` |

### Views

| View | Purpose | Columns |
|------|---------|---------|
| `patient_balances` | Real-time balance calculation | `patient_id`, `balance`, `last_visit`, `transaction_count` |

### Security

- **RLS Enabled** on all tables
- **Multi-tenancy** enforced via `clinic_id` checks
- **Row-level access** based on `user_clinics` membership
- **Owners** have full CRUD on their clinic
- **Staff** have full CRUD on clinic data (patients, transactions)

## 🧪 Debug Views

After running `003_debug_helpers.sql`, you can use:

```sql
-- See your current clinic access
SELECT * FROM debug_user_clinic_access;

-- See patient/transaction counts you can access
SELECT * FROM debug_patient_access;

-- Test if you have access to a specific clinic
SELECT * FROM test_clinic_access('clinic-uuid-here');
```

## 📝 Migration Best Practices

1. **Always** use the template (`004_migration_template.sql`) for new tables
2. **Always** enable RLS and create policies
3. **Always** create indexes on `clinic_id` foreign keys
4. **Never** store calculated balances (use the view)
5. **Always** include `updated_at` triggers for auditability
6. **Test** with multiple users to verify RLS isolation

## 🚨 Production Checklist

- [ ] Run `001_master_schema.sql` on fresh project
- [ ] Verify RLS policies on all tables
- [ ] Verify `patient_balances` view exists and has SELECT grant
- [ ] Verify `handle_clinic_creation()` trigger exists
- [ ] Test multi-user access isolation
- [ ] Configure Auth redirect URLs in Supabase dashboard
- [ ] Set up environment variables in deployment
- [ ] Enable email confirmations if needed
- [ ] Set up row-level security policies for service roles if using server-side

## 📚 References

- [Supabase RLS Docs](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgREST Notifications](https://postgrest.org/en/stable/api.html#notifications)
- [PostgreSQL Triggers](https://www.postgresql.org/docs/current/sql-createtrigger.html)

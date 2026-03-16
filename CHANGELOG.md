# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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

### Changed
- Moved phone normalization logic to phoneUtils.ts with additional validation
- Added comprehensive test function for phone normalization

### Security
- Implemented RLS policies to ensure users only see their clinic's data
- Added unique constraints on clinic names to prevent conflicts
- Enforced foreign key relationships for data integrity
- Added database migration file with proper schema and constraints
- Added session validation to ensure users only access authorized clinics
- Updated Next.js to version 14.2.35 to patch critical security vulnerabilities
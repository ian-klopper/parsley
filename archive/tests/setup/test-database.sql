-- Test Database Setup
-- This sets up a dedicated test database with seeded users for comprehensive testing

-- Create test users with known IDs for consistent testing
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  aud,
  role
) VALUES 
(
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'admin@test.com',
  crypt('password123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  'authenticated',
  'authenticated'
),
(
  '22222222-2222-2222-2222-222222222222',
  '00000000-0000-0000-0000-000000000000',
  'usera@test.com',
  crypt('password123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  'authenticated',
  'authenticated'
),
(
  '33333333-3333-3333-3333-333333333333',
  '00000000-0000-0000-0000-000000000000',
  'userb@test.com',
  crypt('password123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  'authenticated',
  'authenticated'
),
(
  '44444444-4444-4444-4444-444444444444',
  '00000000-0000-0000-0000-000000000000',
  'pending@test.com',
  crypt('password123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  'authenticated',
  'authenticated'
);

-- Create corresponding public.users records
INSERT INTO public.users (
  id,
  email,
  full_name,
  role,
  created_at,
  updated_at,
  approved_at,
  approved_by
) VALUES
(
  '11111111-1111-1111-1111-111111111111',
  'admin@test.com',
  'Admin User',
  'admin',
  NOW(),
  NOW(),
  NOW(),
  '11111111-1111-1111-1111-111111111111'
),
(
  '22222222-2222-2222-2222-222222222222',
  'usera@test.com',
  'User A',
  'user',
  NOW(),
  NOW(),
  NOW(),
  '11111111-1111-1111-1111-111111111111'
),
(
  '33333333-3333-3333-3333-333333333333',
  'userb@test.com',
  'User B',
  'user',
  NOW(),
  NOW(),
  NOW(),
  '11111111-1111-1111-1111-111111111111'
),
(
  '44444444-4444-4444-4444-444444444444',
  'pending@test.com',
  'Pending User',
  'pending',
  NOW(),
  NOW(),
  NULL,
  NULL
);

-- Create some test jobs for ownership transfer testing
INSERT INTO public.jobs (
  id,
  venue,
  job_id,
  status,
  created_by,
  owner_id,
  collaborators,
  created_at,
  updated_at
) VALUES
(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Test Venue A',
  'JOB-001',
  'draft',
  '22222222-2222-2222-2222-222222222222',
  '22222222-2222-2222-2222-222222222222',
  '{}',
  NOW(),
  NOW()
),
(
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'Test Venue B',
  'JOB-002',
  'live',
  '33333333-3333-3333-3333-333333333333',
  '33333333-3333-3333-3333-333333333333',
  '{"22222222-2222-2222-2222-222222222222"}',
  NOW(),
  NOW()
);
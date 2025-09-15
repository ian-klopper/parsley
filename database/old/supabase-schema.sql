-- Create users table with role-based access control
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT auth.uid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  initials TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'pending' CHECK (role IN ('pending', 'user', 'admin')),
  color_index INTEGER DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  approved_by UUID REFERENCES public.users(id)
);

-- Create logs table for activity tracking
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) NOT NULL,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'failure', 'pending')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create jobs table
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue TEXT NOT NULL,
  job_id TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'live', 'processing', 'complete', 'error')),
  created_by UUID REFERENCES public.users(id) NOT NULL,
  collaborators UUID[] DEFAULT '{}',
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Users table policies
CREATE POLICY "Users can view their own profile and approved users" ON public.users
  FOR SELECT USING (
    auth.uid() = id OR 
    (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'user')
  );

CREATE POLICY "Users can update their own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Only admins can insert/delete users" ON public.users
  FOR INSERT WITH CHECK ((SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Only admins can delete users" ON public.users
  FOR DELETE USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

-- Activity logs policies
CREATE POLICY "Users can view logs based on role" ON public.activity_logs
  FOR SELECT USING (
    CASE 
      WHEN (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin' THEN true
      ELSE user_id = auth.uid()
    END
  );

CREATE POLICY "Users can insert their own logs" ON public.activity_logs
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Jobs table policies  
CREATE POLICY "Users can view jobs they have access to" ON public.jobs
  FOR SELECT USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin' OR
    created_by = auth.uid() OR
    auth.uid() = ANY(collaborators)
  );

CREATE POLICY "Users can create jobs" ON public.jobs
  FOR INSERT WITH CHECK (
    (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'user')
  );

CREATE POLICY "Users can update jobs they have access to" ON public.jobs
  FOR UPDATE USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin' OR
    created_by = auth.uid()
  );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON public.jobs  
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'pending'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user registration
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to generate user initials
CREATE OR REPLACE FUNCTION public.generate_initials(full_name TEXT)
RETURNS TEXT AS $$
BEGIN
  IF full_name IS NULL OR full_name = '' THEN
    RETURN '??';
  END IF;
  
  RETURN UPPER(
    SUBSTRING(split_part(full_name, ' ', 1), 1, 1) || 
    COALESCE(SUBSTRING(split_part(full_name, ' ', 2), 1, 1), '')
  );
END;
$$ LANGUAGE plpgsql;

-- Update existing users to have initials
UPDATE public.users 
SET initials = public.generate_initials(full_name) 
WHERE initials IS NULL;
-- Create users table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('employer', 'candidate', 'admin')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = auth_id);

CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = auth_id);

-- Create jobs table
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  min_experience INT DEFAULT 0,
  threshold INT DEFAULT 70,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active jobs"
  ON public.jobs FOR SELECT
  USING (status = 'active');

CREATE POLICY "Employers can create jobs"
  ON public.jobs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = employer_id 
      AND auth_id = auth.uid() 
      AND role = 'employer'
    )
  );

CREATE POLICY "Employers can update their own jobs"
  ON public.jobs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = employer_id 
      AND auth_id = auth.uid()
    )
  );

CREATE POLICY "Employers can delete their own jobs"
  ON public.jobs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = employer_id 
      AND auth_id = auth.uid()
    )
  );

-- Create resumes table (without cross-table policies yet)
CREATE TABLE IF NOT EXISTS public.resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  file_path TEXT NOT NULL,
  parsed JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Candidates can view their own resumes"
  ON public.resumes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = candidate_id 
      AND auth_id = auth.uid()
    )
  );

CREATE POLICY "Candidates can insert their own resumes"
  ON public.resumes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = candidate_id 
      AND auth_id = auth.uid() 
      AND role = 'candidate'
    )
  );

CREATE POLICY "Candidates can update their own resumes"
  ON public.resumes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = candidate_id 
      AND auth_id = auth.uid()
    )
  );

-- Create matches table
CREATE TABLE IF NOT EXISTS public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
  resume_id UUID REFERENCES public.resumes(id) ON DELETE CASCADE NOT NULL,
  score INT CHECK (score >= 0 AND score <= 100),
  breakdown JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(job_id, resume_id)
);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employers can view matches for their jobs"
  ON public.matches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs j
      JOIN public.users u ON u.id = j.employer_id
      WHERE j.id = matches.job_id
      AND u.auth_id = auth.uid()
    )
  );

CREATE POLICY "Candidates can view their own matches"
  ON public.matches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.resumes r
      JOIN public.users u ON u.id = r.candidate_id
      WHERE r.id = matches.resume_id
      AND u.auth_id = auth.uid()
    )
  );

-- Create shortlists table
CREATE TABLE IF NOT EXISTS public.shortlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
  resume_id UUID REFERENCES public.resumes(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'shortlisted' CHECK (status IN ('shortlisted', 'rejected', 'interviewed', 'hired')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(job_id, resume_id)
);

ALTER TABLE public.shortlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employers can manage shortlists for their jobs"
  ON public.shortlists FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs j
      JOIN public.users u ON u.id = j.employer_id
      WHERE j.id = shortlists.job_id
      AND u.auth_id = auth.uid()
    )
  );

CREATE POLICY "Candidates can view their shortlist status"
  ON public.shortlists FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.resumes r
      JOIN public.users u ON u.id = r.candidate_id
      WHERE r.id = shortlists.resume_id
      AND u.auth_id = auth.uid()
    )
  );

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = user_id 
      AND auth_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- NOW add the cross-table policy for resumes that references matches
CREATE POLICY "Employers can view resumes for their jobs"
  ON public.resumes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      JOIN public.jobs j ON j.id = m.job_id
      JOIN public.users u ON u.id = j.employer_id
      WHERE m.resume_id = resumes.id
      AND u.auth_id = auth.uid()
    )
  );

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (auth_id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'candidate')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
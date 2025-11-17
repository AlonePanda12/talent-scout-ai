-- Create storage bucket for resumes
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false);

-- Create RLS policies for resume storage
CREATE POLICY "Candidates can upload their own resumes"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'resumes' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Candidates can view their own resumes"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'resumes' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Service role can access all resumes"
ON storage.objects
FOR ALL
USING (bucket_id = 'resumes')
WITH CHECK (bucket_id = 'resumes');
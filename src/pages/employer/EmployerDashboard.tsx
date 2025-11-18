import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
const sb = supabase as any;
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, Users, FileText, LogOut, Plus, Download, Eye } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface Job {
  id: string;
  title: string;
  description: string;
  created_at: string;
  status: string;
}

interface MatchedResume {
  id: string;
  score: number;
  job_title: string;
  job_id: string;
  candidate_name: string;
  candidate_email: string;
  file_path: string;
  parsed: any;
  created_at: string;
}

const EmployerDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [userName, setUserName] = useState("");
  const [matchedResumes, setMatchedResumes] = useState<MatchedResume[]>([]);
  const [resumesLoading, setResumesLoading] = useState(true);

  useEffect(() => {
    checkAuth();
    fetchJobs();
    fetchMatchedResumes();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/login");
      return;
    }
    if (session.user.user_metadata.role !== "employer") {
      toast.error("Unauthorized access");
      navigate("/");
      return;
    }
    setUserName(session.user.user_metadata.full_name || session.user.email || "User");
  };

  const fetchJobs = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      let { data: userData, error: userError } = await (sb as any)
        .from("users")
        .select("id")
        .eq("auth_id", user.id)
        .maybeSingle();

      if (userError) {
        console.error("Error fetching user:", userError);
        toast.error("Failed to load user profile");
        setLoading(false);
        return;
      }

      // Create user profile if it doesn't exist
      if (!userData) {
        const { data: newUser, error: insertError } = await (sb as any)
          .from("users")
          .insert({
            auth_id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
            role: 'employer'
          })
          .select("id")
          .single();

        if (insertError) {
          console.error("Error creating user profile:", insertError);
          toast.error("Failed to create user profile. Please contact support.");
          setLoading(false);
          return;
        }

        userData = newUser;
        toast.success("Profile created successfully!");
      }

      const { data, error } = await (sb as any)
        .from("jobs")
        .select("*")
        .eq("employer_id", userData.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error("Error fetching jobs:", error);
      toast.error("Failed to load jobs");
    } finally {
      setLoading(false);
    }
  };

  const fetchMatchedResumes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setResumesLoading(false);
        return;
      }

      const { data: userData } = await (sb as any)
        .from("users")
        .select("id")
        .eq("auth_id", user.id)
        .maybeSingle();

      if (!userData) {
        setResumesLoading(false);
        return;
      }

      // Fetch all matches for jobs owned by this employer
      const { data, error } = await (sb as any)
        .from("matches")
        .select(`
          id,
          score,
          created_at,
          job_id,
          jobs!inner(title, employer_id),
          resumes!inner(
            id,
            file_path,
            parsed,
            candidate_id,
            users!inner(full_name, email)
          )
        `)
        .eq("jobs.employer_id", userData.id)
        .order("score", { ascending: false });

      if (error) throw error;

      const formattedResumes = (data || []).map((match: any) => ({
        id: match.resumes.id,
        score: match.score,
        job_title: match.jobs.title,
        job_id: match.job_id,
        candidate_name: match.resumes.users.full_name,
        candidate_email: match.resumes.users.email,
        file_path: match.resumes.file_path,
        parsed: match.resumes.parsed,
        created_at: match.created_at,
      }));

      setMatchedResumes(formattedResumes);
    } catch (error) {
      console.error("Error fetching matched resumes:", error);
      toast.error("Failed to load matched resumes");
    } finally {
      setResumesLoading(false);
    }
  };

  const handleDownloadResume = async (filePath: string, candidateName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("resumes")
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${candidateName}_resume.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Resume downloaded successfully");
    } catch (error) {
      console.error("Error downloading resume:", error);
      toast.error("Failed to download resume");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Employer Dashboard</h1>
            <p className="text-muted-foreground">Welcome back, {userName}</p>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {jobs.filter(j => j.status === 'active').length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{jobs.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Matched Resumes</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{matchedResumes.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Jobs Section */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Your Jobs</CardTitle>
                <CardDescription>Manage your job postings and view applications</CardDescription>
              </div>
              <Link to="/employer/create-job">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Job
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center text-muted-foreground py-8">Loading jobs...</p>
            ) : jobs.length === 0 ? (
              <div className="text-center py-12">
                <Briefcase className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No jobs posted yet</p>
                <Link to="/employer/create-job">
                  <Button>Create Your First Job</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {jobs.map((job) => (
                  <Link key={job.id} to={`/employer/jobs/${job.id}`}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg">{job.title}</CardTitle>
                            <CardDescription className="line-clamp-2 mt-1">
                              {job.description}
                            </CardDescription>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            job.status === 'active' 
                              ? 'bg-success/10 text-success' 
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {job.status}
                          </span>
                        </div>
                      </CardHeader>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Matched Resumes Section */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Matched Resumes</CardTitle>
            <CardDescription>View resumes matched to your job postings</CardDescription>
          </CardHeader>
          <CardContent>
            {resumesLoading ? (
              <p className="text-center text-muted-foreground py-8">Loading resumes...</p>
            ) : matchedResumes.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No matched resumes yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {matchedResumes.map((resume) => (
                  <Card key={resume.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <CardTitle className="text-lg">{resume.candidate_name}</CardTitle>
                            <Badge variant="secondary" className="text-xs">
                              Match: {resume.score}%
                            </Badge>
                          </div>
                          <CardDescription className="space-y-1">
                            <p>Email: {resume.candidate_email}</p>
                            <p>Job: {resume.job_title}</p>
                            {resume.parsed?.experience && (
                              <p>Experience: {resume.parsed.experience} years</p>
                            )}
                            {resume.parsed?.skills && Array.isArray(resume.parsed.skills) && (
                              <p className="flex flex-wrap gap-1 mt-2">
                                Skills: {resume.parsed.skills.slice(0, 5).map((skill: string, idx: number) => (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    {skill}
                                  </Badge>
                                ))}
                              </p>
                            )}
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadResume(resume.file_path, resume.candidate_name)}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EmployerDashboard;

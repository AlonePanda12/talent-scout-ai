import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
const sb = supabase as any;
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Download, Mail, Briefcase, Calendar, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface ResumeData {
  id: string;
  candidate_name: string;
  candidate_email: string;
  job_title: string;
  job_id: string;
  score: number;
  file_path: string;
  parsed: any;
  created_at: string;
}

const ResumeDetails = () => {
  const navigate = useNavigate();
  const { resumeId } = useParams();
  const [loading, setLoading] = useState(true);
  const [resume, setResume] = useState<ResumeData | null>(null);

  useEffect(() => {
    fetchResumeDetails();
  }, [resumeId]);

  const fetchResumeDetails = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }

      const { data: userData } = await (sb as any)
        .from("users")
        .select("id")
        .eq("auth_id", user.id)
        .maybeSingle();

      if (!userData) {
        toast.error("User profile not found");
        navigate("/employer/dashboard");
        return;
      }

      // Fetch resume with match details
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
        .eq("resumes.id", resumeId)
        .eq("jobs.employer_id", userData.id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        toast.error("Resume not found");
        navigate("/employer/dashboard");
        return;
      }

      setResume({
        id: data.resumes.id,
        score: data.score,
        job_title: data.jobs.title,
        job_id: data.job_id,
        candidate_name: data.resumes.users.full_name,
        candidate_email: data.resumes.users.email,
        file_path: data.resumes.file_path,
        parsed: data.resumes.parsed,
        created_at: data.created_at,
      });
    } catch (error) {
      console.error("Error fetching resume details:", error);
      toast.error("Failed to load resume details");
      navigate("/employer/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadResume = async () => {
    if (!resume) return;
    
    try {
      const { data, error } = await supabase.storage
        .from("resumes")
        .download(resume.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${resume.candidate_name}_resume.pdf`;
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading resume details...</p>
      </div>
    );
  }

  if (!resume) {
    return null;
  }

  const parsed = resume.parsed || {};

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate("/employer/dashboard")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <Button onClick={handleDownloadResume}>
              <Download className="w-4 h-4 mr-2" />
              Download Resume
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Candidate Header */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-3xl mb-2">{resume.candidate_name}</CardTitle>
                <div className="flex flex-wrap gap-3 text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Mail className="w-4 h-4" />
                    <span>{resume.candidate_email}</span>
                  </div>
                  {parsed.location && (
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      <span>{parsed.location}</span>
                    </div>
                  )}
                  {parsed.phone && (
                    <span>{parsed.phone}</span>
                  )}
                </div>
              </div>
              <Badge variant="secondary" className="text-lg px-4 py-2">
                {resume.score}% Match
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Briefcase className="w-4 h-4" />
              <span>Applied for: <strong>{resume.job_title}</strong></span>
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        {parsed.summary && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Professional Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground leading-relaxed">{parsed.summary}</p>
            </CardContent>
          </Card>
        )}

        {/* Skills */}
        {parsed.skills && Array.isArray(parsed.skills) && parsed.skills.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Skills</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {parsed.skills.map((skill: string, idx: number) => (
                  <Badge key={idx} variant="outline">
                    {skill}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Experience */}
        {parsed.experience && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Experience</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {typeof parsed.experience === 'number' ? (
                <p className="text-foreground">
                  <strong>{parsed.experience}</strong> years of experience
                </p>
              ) : Array.isArray(parsed.experience) ? (
                parsed.experience.map((exp: any, idx: number) => (
                  <div key={idx} className="space-y-2">
                    {idx > 0 && <Separator className="my-4" />}
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-lg">{exp.title || exp.position}</h3>
                        <p className="text-muted-foreground">{exp.company}</p>
                      </div>
                      {(exp.start_date || exp.end_date) && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {exp.start_date} - {exp.end_date || 'Present'}
                          </span>
                        </div>
                      )}
                    </div>
                    {exp.description && (
                      <p className="text-foreground leading-relaxed">{exp.description}</p>
                    )}
                    {exp.responsibilities && Array.isArray(exp.responsibilities) && (
                      <ul className="list-disc list-inside space-y-1 text-foreground">
                        {exp.responsibilities.map((resp: string, i: number) => (
                          <li key={i}>{resp}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-foreground">{parsed.experience}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Education */}
        {parsed.education && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Education</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.isArray(parsed.education) ? (
                parsed.education.map((edu: any, idx: number) => (
                  <div key={idx} className="space-y-2">
                    {idx > 0 && <Separator className="my-4" />}
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-lg">{edu.degree}</h3>
                        <p className="text-muted-foreground">{edu.institution || edu.school}</p>
                        {edu.field && (
                          <p className="text-sm text-muted-foreground">{edu.field}</p>
                        )}
                      </div>
                      {(edu.start_date || edu.end_date || edu.year) && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {edu.year || `${edu.start_date} - ${edu.end_date || 'Present'}`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-foreground">{parsed.education}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Certifications */}
        {parsed.certifications && Array.isArray(parsed.certifications) && parsed.certifications.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Certifications</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {parsed.certifications.map((cert: any, idx: number) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-foreground">
                      {typeof cert === 'string' ? cert : `${cert.name}${cert.issuer ? ` - ${cert.issuer}` : ''}${cert.date ? ` (${cert.date})` : ''}`}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Languages */}
        {parsed.languages && Array.isArray(parsed.languages) && parsed.languages.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Languages</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {parsed.languages.map((lang: any, idx: number) => (
                  <Badge key={idx} variant="secondary">
                    {typeof lang === 'string' ? lang : `${lang.language}${lang.proficiency ? ` - ${lang.proficiency}` : ''}`}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Additional Info */}
        {parsed.projects && Array.isArray(parsed.projects) && parsed.projects.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Projects</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {parsed.projects.map((project: any, idx: number) => (
                <div key={idx} className="space-y-2">
                  {idx > 0 && <Separator className="my-4" />}
                  <h3 className="font-semibold text-lg">{project.name || project.title}</h3>
                  {project.description && (
                    <p className="text-foreground leading-relaxed">{project.description}</p>
                  )}
                  {project.technologies && Array.isArray(project.technologies) && (
                    <div className="flex flex-wrap gap-1">
                      {project.technologies.map((tech: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {tech}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ResumeDetails;

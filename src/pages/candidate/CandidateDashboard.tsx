import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
const sb = supabase as any;
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, LogOut, Upload, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

interface Resume {
  id: string;
  file_path: string;
  status: string;
  parsed: any;
  created_at: string;
}

const CandidateDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState("");

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
        return;
      }
      if (session.user.user_metadata.role !== "candidate") {
        toast.error("Unauthorized access");
        navigate("/");
        return;
      }
      setUserName(session.user.user_metadata.full_name || session.user.email || "User");
      
      let { data: userData, error: userError } = await (sb as any)
        .from("users")
        .select("id")
        .eq("auth_id", session.user.id)
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
            auth_id: session.user.id,
            email: session.user.email,
            full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
            role: 'candidate'
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

      setUserId(userData.id);
      fetchResumes(userData.id);
      setLoading(false);
    } catch (error) {
      console.error("Error in checkAuth:", error);
      toast.error("An unexpected error occurred");
      setLoading(false);
    }
  };

  const fetchResumes = async (candidateId: string) => {
    try {
      const { data, error } = await (sb as any)
        .from("resumes")
        .select("*")
        .eq("candidate_id", candidateId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setResumes(data || []);
    } catch (error) {
      console.error("Error fetching resumes:", error);
      toast.error("Failed to load resumes");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Please upload a PDF or DOCX file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload file to storage
      const fileName = `${user.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("resumes")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Create resume record
      const { error: insertError } = await (sb as any)
        .from("resumes")
        .insert({
          candidate_id: userId,
          file_path: fileName,
          status: "pending"
        });

      if (insertError) throw insertError;

      // Get the resume ID from the insert
      const { data: resumeData } = await (sb as any)
        .from("resumes")
        .select("id")
        .eq("candidate_id", userId)
        .eq("file_path", fileName)
        .single();

      if (resumeData?.id) {
        // Trigger AI parsing
        toast.success("Resume uploaded! AI parsing in progress...");
        
        // Call the edge function to parse the resume
        const { error: parseError } = await supabase.functions.invoke('parse-resume', {
          body: { resumeId: resumeData.id }
        });

        if (parseError) {
          console.error("Error triggering resume parsing:", parseError);
          toast.error("Resume uploaded but parsing failed. Please try again.");
        } else {
          toast.success("Resume parsed successfully!");
        }
      }

      fetchResumes(userId);

      // Reset file input
      e.target.value = "";
    } catch (error) {
      console.error("Error uploading resume:", error);
      toast.error("Failed to upload resume");
    } finally {
      setUploading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Candidate Dashboard</h1>
            <p className="text-muted-foreground">Welcome back, {userName}</p>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Upload Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Upload Resume</CardTitle>
            <CardDescription>
              Upload your resume in PDF or DOCX format. Our AI will automatically parse and analyze it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Label htmlFor="resume-upload" className="cursor-pointer">
                  <div className="flex items-center gap-2 px-4 py-2 border-2 border-dashed rounded-lg hover:border-primary transition-colors">
                    <Upload className="w-5 h-5" />
                    <span>{uploading ? "Uploading..." : "Choose File"}</span>
                  </div>
                  <Input
                    id="resume-upload"
                    type="file"
                    accept=".pdf,.docx"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                </Label>
                <p className="text-sm text-muted-foreground">
                  PDF or DOCX, max 5MB
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resumes List */}
        <Card>
          <CardHeader>
            <CardTitle>Your Resumes</CardTitle>
            <CardDescription>View your uploaded resumes and their processing status</CardDescription>
          </CardHeader>
          <CardContent>
            {resumes.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No resumes uploaded yet</p>
                <p className="text-sm text-muted-foreground">
                  Upload your first resume to get started with job matching
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {resumes.map((resume) => (
                  <Card key={resume.id} className="border-l-4 border-l-primary">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <FileText className="w-5 h-5" />
                            {resume.file_path.split('/').pop()}
                          </CardTitle>
                          <CardDescription>
                            Uploaded {new Date(resume.created_at).toLocaleDateString()}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          {resume.status === 'processed' ? (
                            <span className="flex items-center gap-1 text-success">
                              <CheckCircle className="w-4 h-4" />
                              Processed
                            </span>
                          ) : resume.status === 'failed' ? (
                            <span className="flex items-center gap-1 text-destructive">
                              <XCircle className="w-4 h-4" />
                              Failed
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Processing...</span>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    {resume.parsed && (
                      <CardContent>
                        <div className="space-y-2 text-sm">
                          {resume.parsed.name && (
                            <p><strong>Name:</strong> {resume.parsed.name}</p>
                          )}
                          {resume.parsed.email && (
                            <p><strong>Email:</strong> {resume.parsed.email}</p>
                          )}
                          {resume.parsed.skills && resume.parsed.skills.length > 0 && (
                            <div>
                              <strong>Skills:</strong>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {resume.parsed.skills.slice(0, 10).map((skill: string, idx: number) => (
                                  <span key={idx} className="px-2 py-1 bg-primary/10 text-primary rounded text-xs">
                                    {skill}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    )}
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

export default CandidateDashboard;

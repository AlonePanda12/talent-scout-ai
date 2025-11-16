import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
const sb = supabase as any;
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Link } from "react-router-dom";

const jobSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(50, "Description must be at least 50 characters"),
  skills: z.array(z.object({
    name: z.string(),
    weight: z.number().min(1).max(10)
  })).min(1, "At least one skill is required"),
  minExperience: z.number().min(0),
  threshold: z.number().min(0).max(100)
});

interface Skill {
  name: string;
  weight: number;
}

const CreateJob = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    minExperience: 0,
    threshold: 70
  });
  const [skills, setSkills] = useState<Skill[]>([]);
  const [newSkill, setNewSkill] = useState({ name: "", weight: 5 });

  const addSkill = () => {
    if (!newSkill.name.trim()) {
      toast.error("Skill name cannot be empty");
      return;
    }
    setSkills([...skills, { ...newSkill, name: newSkill.name.trim() }]);
    setNewSkill({ name: "", weight: 5 });
  };

  const removeSkill = (index: number) => {
    setSkills(skills.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validated = jobSchema.parse({
        ...formData,
        skills
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: userData } = await (sb as any)
        .from("users")
        .select("id")
        .eq("auth_id", user.id)
        .single();

      if (!userData) throw new Error("User not found");

      const { data, error } = await (sb as any)
        .from("jobs")
        .insert({
          employer_id: userData.id,
          title: validated.title,
          description: validated.description,
          skills: validated.skills,
          min_experience: validated.minExperience,
          threshold: validated.threshold
        })
        .select()
        .single();

      if (error || !data) throw (error || new Error("Failed to create job"));

      toast.success("Job posted successfully!");
      navigate(`/employer/jobs/${data.id}`);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to create job");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Link to="/employer/dashboard">
            <Button variant="ghost">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Create New Job</CardTitle>
            <CardDescription>
              Post a new job and let AI match the best candidates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Job Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g. Senior Software Engineer"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Job Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Describe the role, responsibilities, and requirements..."
                  rows={6}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-4">
                <Label>Required Skills *</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Skill name (e.g. Python)"
                    value={newSkill.name}
                    onChange={(e) => setNewSkill({ ...newSkill, name: e.target.value })}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                  />
                  <Input
                    type="number"
                    placeholder="Weight"
                    min="1"
                    max="10"
                    value={newSkill.weight}
                    onChange={(e) => setNewSkill({ ...newSkill, weight: parseInt(e.target.value) })}
                    className="w-24"
                  />
                  <Button type="button" onClick={addSkill} variant="outline">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Weight: 1-10 (higher = more important)
                </p>
                
                {skills.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {skills.map((skill, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full"
                      >
                        <span>{skill.name}</span>
                        <span className="text-xs opacity-75">(w:{skill.weight})</span>
                        <button
                          type="button"
                          onClick={() => removeSkill(index)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="minExperience">Minimum Experience (years)</Label>
                  <Input
                    id="minExperience"
                    type="number"
                    min="0"
                    value={formData.minExperience}
                    onChange={(e) => setFormData({ ...formData, minExperience: parseInt(e.target.value) })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="threshold">Auto-Shortlist Threshold (%)</Label>
                  <Input
                    id="threshold"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.threshold}
                    onChange={(e) => setFormData({ ...formData, threshold: parseInt(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Candidates scoring above this will be auto-shortlisted
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? "Creating..." : "Create Job"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/employer/dashboard")}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CreateJob;

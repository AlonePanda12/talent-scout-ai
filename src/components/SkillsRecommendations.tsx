import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Target, BookOpen } from "lucide-react";

interface JobMatch {
  breakdown: {
    missing: string[];
  };
}

interface SkillsRecommendationsProps {
  matches: JobMatch[];
}

interface SkillFrequency {
  skill: string;
  count: number;
  percentage: number;
}

const SkillsRecommendations = ({ matches }: SkillsRecommendationsProps) => {
  // Calculate skill frequencies
  const skillFrequencies = new Map<string, number>();
  
  matches.forEach((match) => {
    if (match.breakdown?.missing) {
      match.breakdown.missing.forEach((skill: string) => {
        skillFrequencies.set(skill, (skillFrequencies.get(skill) || 0) + 1);
      });
    }
  });

  // Convert to array and sort by frequency
  const sortedSkills: SkillFrequency[] = Array.from(skillFrequencies.entries())
    .map(([skill, count]) => ({
      skill,
      count,
      percentage: Math.round((count / matches.length) * 100)
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // Top 10 skills

  if (sortedSkills.length === 0) {
    return null;
  }

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          Skills to Improve
        </CardTitle>
        <CardDescription>
          Focus on these skills to match more job opportunities
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sortedSkills.map((skillData, idx) => (
            <div key={skillData.skill} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm font-medium">
                    {idx + 1}.
                  </span>
                  <Badge 
                    variant="outline" 
                    className="text-sm font-medium"
                  >
                    {skillData.skill}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-primary">
                    {skillData.count} {skillData.count === 1 ? 'job' : 'jobs'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Progress 
                  value={skillData.percentage} 
                  className="h-2 flex-1" 
                />
                <span className="text-xs text-muted-foreground min-w-[45px]">
                  {skillData.percentage}%
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-muted rounded-lg">
          <div className="flex items-start gap-3">
            <BookOpen className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <h4 className="text-sm font-semibold">Learning Tip</h4>
              <p className="text-sm text-muted-foreground">
                Focus on the top 3-5 skills to significantly improve your match rates. 
                Consider online courses, certifications, or personal projects to develop these skills.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SkillsRecommendations;

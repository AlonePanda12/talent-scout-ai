import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { resumeId } = await req.json();
    
    if (!resumeId) {
      throw new Error("resumeId is required");
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get resume details
    const { data: resume, error: resumeError } = await supabase
      .from('resumes')
      .select('*, candidate:candidate_id(id, full_name, email)')
      .eq('id', resumeId)
      .single();

    if (resumeError || !resume) {
      throw new Error(`Resume not found: ${resumeError?.message}`);
    }

    // Download the file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('resumes')
      .download(resume.file_path);

    if (downloadError) {
      throw new Error(`Failed to download resume: ${downloadError.message}`);
    }

    // Convert file to text
    const fileText = await fileData.text();

    // Use Lovable AI to parse the resume
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a resume parsing assistant. Extract structured information from resumes and return it in JSON format.'
          },
          {
            role: 'user',
            content: `Parse this resume and extract the following information in JSON format:
{
  "name": "candidate full name",
  "email": "email address",
  "phone": "phone number",
  "skills": ["array of skills"],
  "experience_years": "number of years of experience",
  "education": "education details",
  "summary": "brief professional summary"
}

Resume text:
${fileText}`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "parse_resume",
            description: "Extract structured data from resume",
            parameters: {
              type: "object",
              properties: {
                name: { type: "string" },
                email: { type: "string" },
                phone: { type: "string" },
                skills: { 
                  type: "array",
                  items: { type: "string" }
                },
                experience_years: { type: "number" },
                education: { type: "string" },
                summary: { type: "string" }
              },
              required: ["name", "skills"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "parse_resume" } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      throw new Error(`AI parsing failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error('No structured data returned from AI');
    }

    const parsedData = JSON.parse(toolCall.function.arguments);

    // Update resume with parsed data
    const { error: updateError } = await supabase
      .from('resumes')
      .update({
        parsed: parsedData,
        status: 'processed',
        updated_at: new Date().toISOString()
      })
      .eq('id', resumeId);

    if (updateError) {
      throw new Error(`Failed to update resume: ${updateError.message}`);
    }

    // Now match against all active jobs
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('*')
      .eq('status', 'active');

    if (jobsError) {
      console.error('Error fetching jobs:', jobsError);
    } else if (jobs && jobs.length > 0) {
      // For each job, calculate match score
      for (const job of jobs) {
        const matchScore = calculateMatchScore(parsedData.skills, job.skills);
        
        // Insert or update match
        const { error: matchError } = await supabase
          .from('matches')
          .upsert({
            job_id: job.id,
            resume_id: resumeId,
            score: matchScore.score,
            breakdown: matchScore.breakdown
          });

        if (matchError) {
          console.error('Error creating match:', matchError);
        }

        // Auto-shortlist if score meets threshold
        if (matchScore.score >= job.threshold) {
          const { error: shortlistError } = await supabase
            .from('shortlists')
            .upsert({
              job_id: job.id,
              resume_id: resumeId,
              status: 'shortlisted'
            });

          if (shortlistError) {
            console.error('Error creating shortlist:', shortlistError);
          }
        }
      }
    }

    // Log activity
    const { data: candidate } = await supabase
      .from('users')
      .select('id')
      .eq('id', resume.candidate_id)
      .single();

    if (candidate) {
      await supabase.from('audit_logs').insert({
        user_id: candidate.id,
        action: 'resume_parsed',
        metadata: { resumeId, parsedData }
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        parsed: parsedData,
        matchesCreated: jobs?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in parse-resume function:', error);
    
    // Update resume status to failed
    if (error instanceof Error) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      try {
        await supabase
          .from('resumes')
          .update({ status: 'failed' })
          .eq('id', await req.json().then(data => data.resumeId));
      } catch {}
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

function calculateMatchScore(
  candidateSkills: string[],
  jobSkills: Array<{ name: string; weight: number }>
): { score: number; breakdown: any } {
  if (!candidateSkills || candidateSkills.length === 0) {
    return { score: 0, breakdown: { matched: [], missing: jobSkills.map(s => s.name) } };
  }

  const normalizedCandidateSkills = candidateSkills.map(s => s.toLowerCase().trim());
  
  let totalWeight = 0;
  let matchedWeight = 0;
  const matched: string[] = [];
  const missing: string[] = [];

  for (const jobSkill of jobSkills) {
    totalWeight += jobSkill.weight;
    const normalizedJobSkill = jobSkill.name.toLowerCase().trim();
    
    // Check for exact match or fuzzy match
    const isMatch = normalizedCandidateSkills.some(cs => 
      cs === normalizedJobSkill || 
      cs.includes(normalizedJobSkill) || 
      normalizedJobSkill.includes(cs)
    );

    if (isMatch) {
      matchedWeight += jobSkill.weight;
      matched.push(jobSkill.name);
    } else {
      missing.push(jobSkill.name);
    }
  }

  const score = totalWeight > 0 ? Math.round((matchedWeight / totalWeight) * 100) : 0;

  return {
    score,
    breakdown: {
      matched,
      missing,
      totalSkills: jobSkills.length,
      matchedSkills: matched.length,
      totalWeight,
      matchedWeight
    }
  };
}

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Brain, Target, Zap, Shield, TrendingUp, Users } from "lucide-react";
import { Link } from "react-router-dom";

const Landing = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero opacity-10" />
        <div className="container mx-auto px-4 py-20 relative">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
              AI-Powered Resume Screening Platform
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
              Transform your hiring process with intelligent resume parsing and skill matching
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link to="/signup?role=employer">
                <Button size="lg" className="w-full sm:w-auto">
                  Get Started as Employer
                </Button>
              </Link>
              <Link to="/signup?role=candidate">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Apply as Candidate
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Intelligent Hiring Made Simple
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Leverage AI to streamline your recruitment process and find the perfect candidates
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="p-6 space-y-4 hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Brain className="w-6 h-6 text-primary-foreground" />
            </div>
            <h3 className="text-xl font-semibold">AI Resume Parsing</h3>
            <p className="text-muted-foreground">
              Automatically extract key information from resumes including skills, experience, and qualifications
            </p>
          </Card>

          <Card className="p-6 space-y-4 hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 rounded-lg bg-gradient-secondary flex items-center justify-center">
              <Target className="w-6 h-6 text-secondary-foreground" />
            </div>
            <h3 className="text-xl font-semibold">Smart Skill Matching</h3>
            <p className="text-muted-foreground">
              Get precise match scores based on required skills with weighted scoring and synonym recognition
            </p>
          </Card>

          <Card className="p-6 space-y-4 hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Zap className="w-6 h-6 text-primary-foreground" />
            </div>
            <h3 className="text-xl font-semibold">Auto Shortlisting</h3>
            <p className="text-muted-foreground">
              Automatically shortlist candidates who meet your threshold criteria, saving hours of manual review
            </p>
          </Card>

          <Card className="p-6 space-y-4 hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 rounded-lg bg-gradient-secondary flex items-center justify-center">
              <Shield className="w-6 h-6 text-secondary-foreground" />
            </div>
            <h3 className="text-xl font-semibold">Secure & Private</h3>
            <p className="text-muted-foreground">
              Enterprise-grade security with role-based access control and encrypted data storage
            </p>
          </Card>

          <Card className="p-6 space-y-4 hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-primary-foreground" />
            </div>
            <h3 className="text-xl font-semibold">Activity Tracking</h3>
            <p className="text-muted-foreground">
              Complete audit logs of all hiring activities for compliance and process optimization
            </p>
          </Card>

          <Card className="p-6 space-y-4 hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 rounded-lg bg-gradient-secondary flex items-center justify-center">
              <Users className="w-6 h-6 text-secondary-foreground" />
            </div>
            <h3 className="text-xl font-semibold">Candidate Portal</h3>
            <p className="text-muted-foreground">
              Provide candidates with a seamless application experience and real-time status updates
            </p>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <Card className="p-12 bg-gradient-hero text-primary-foreground">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold">
              Ready to Transform Your Hiring Process?
            </h2>
            <p className="text-lg opacity-90">
              Join hundreds of companies using AI-powered screening to find top talent faster
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/login">
                <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                  Sign In
                </Button>
              </Link>
              <Link to="/signup">
                <Button size="lg" variant="outline" className="w-full sm:w-auto border-white text-white hover:bg-white/10">
                  Create Free Account
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2024 Resume Screening Platform. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;

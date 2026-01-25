
export interface UserProfile {
  name: string;
  title: string;
  skills: string[];
  experience: string;
  cvText: string;
  location: string;
}

export interface JobOpportunity {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  descriptionSnippet: string;
  fitScore: number;
  matchAnalysis: string;
  status: 'new' | 'analyzing' | 'applying' | 'applied' | 'rejected';
  appliedDate?: string;
  coverLetter?: string;
}

export interface AgentLog {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'agent';
}

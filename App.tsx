
import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, JobOpportunity, AgentLog } from './types';
import { extractProfileFromCV, searchJobs, analyzeJobFit, draftCoverLetter } from './geminiService';

// --- Icons (Simple SVG versions for portability) ---
const IconSearch = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>;
const IconBot = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>;
const IconUpload = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>;
const IconUser = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const IconCheck = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;

export default function App() {
  const [cvText, setCvText] = useState('');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [jobs, setJobs] = useState<JobOpportunity[]>([]);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const addLog = (message: string, type: AgentLog['type'] = 'info') => {
    setLogs(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      message,
      type
    }]);
  };

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleCvUpload = async () => {
    if (!cvText.trim()) return;
    setIsProcessing(true);
    addLog("Parsing CV document...", "info");
    try {
      const extractedProfile = await extractProfileFromCV(cvText);
      setProfile(extractedProfile);
      addLog(`Profile extracted: ${extractedProfile.name} - ${extractedProfile.title}`, "success");
    } catch (error) {
      addLog("Failed to parse CV. Please ensure it's readable text.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const startJobAgent = async () => {
    if (!profile) return;
    setIsAgentRunning(true);
    addLog("Agent initiated. Scanning the web for matching opportunities...", "agent");
    
    try {
      const foundJobs = await searchJobs(profile);
      setJobs(foundJobs);
      addLog(`Found ${foundJobs.length} potential matches via Google Search.`, "success");

      // Sequential Processing of Jobs
      for (let i = 0; i < foundJobs.length; i++) {
        const job = foundJobs[i];
        
        // Update job status to analyzing
        setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'analyzing' } : j));
        addLog(`Analyzing fit for: ${job.title} at ${job.company}...`, "info");
        
        const { score, analysis } = await analyzeJobFit(job, profile);
        
        setJobs(prev => prev.map(j => j.id === job.id ? { 
          ...j, 
          fitScore: score, 
          matchAnalysis: analysis,
          status: score > 70 ? 'applying' : 'new' 
        } : j));

        if (score > 70) {
          addLog(`High match (${score}%)! Drafting personalized cover letter...`, "success");
          const coverLetter = await draftCoverLetter(job, profile);
          
          // Simulation of applying
          addLog(`Submitting application for ${job.title}...`, "agent");
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          setJobs(prev => prev.map(j => j.id === job.id ? { 
            ...j, 
            status: 'applied', 
            coverLetter,
            appliedDate: new Date().toLocaleDateString() 
          } : j));
          addLog(`Application successfully sent to ${job.company}!`, "success");
        } else {
          addLog(`Fit score too low (${score}%). Skipping application.`, "warning");
          setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'new' } : j));
        }
      }
      
      addLog("Agent task cycle complete. All suitable jobs processed.", "success");
    } catch (error) {
      addLog("Agent encountered an error during search/analysis.", "error");
      console.error(error);
    } finally {
      setIsAgentRunning(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Sidebar: Profile & Setup */}
      <div className="lg:w-96 bg-white border-r border-slate-200 flex flex-col p-6 space-y-8 h-screen sticky top-0">
        <header className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
            <IconBot />
          </div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
            JobFlow AI
          </h1>
        </header>

        {!profile ? (
          <div className="flex-1 flex flex-col space-y-4">
            <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
              <p className="text-sm text-indigo-700 leading-relaxed font-medium">
                Paste your CV text below. Our agent will analyze your skills and find the best roles for you.
              </p>
            </div>
            <textarea
              className="flex-1 w-full p-4 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none bg-slate-50 transition-all"
              placeholder="Paste your CV content here (Experience, Skills, Education)..."
              value={cvText}
              onChange={(e) => setCvText(e.target.value)}
            />
            <button
              onClick={handleCvUpload}
              disabled={isProcessing || !cvText.trim()}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold flex items-center justify-center space-x-2 hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {isProcessing ? (
                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <>
                  <IconUpload />
                  <span>Process CV</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col space-y-6 overflow-y-auto">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-2">
                <IconUser />
                <span>Extracted Profile</span>
              </label>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <h2 className="text-lg font-bold text-slate-800">{profile.name}</h2>
                <p className="text-sm text-indigo-600 font-medium">{profile.title}</p>
                <p className="text-xs text-slate-500 mt-1">{profile.location}</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Core Skills</label>
              <div className="flex flex-wrap gap-2">
                {profile.skills.map(skill => (
                  <span key={skill} className="px-3 py-1 bg-white border border-slate-200 text-xs font-medium text-slate-600 rounded-full shadow-sm">
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Summary</label>
              <p className="text-sm text-slate-600 italic leading-relaxed">
                "{profile.experience.length > 150 ? profile.experience.substring(0, 150) + '...' : profile.experience}"
              </p>
            </div>

            <div className="pt-4 mt-auto">
              <button
                onClick={startJobAgent}
                disabled={isAgentRunning}
                className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold flex items-center justify-center space-x-2 hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all disabled:opacity-50"
              >
                {isAgentRunning ? (
                  <>
                    <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                    <span>Agent Running...</span>
                  </>
                ) : (
                  <>
                    <IconBot />
                    <span>Start Auto-Agent</span>
                  </>
                )}
              </button>
              <button
                onClick={() => { setProfile(null); setJobs([]); setLogs([]); }}
                className="w-full mt-3 py-2 text-sm text-slate-400 hover:text-slate-600 font-medium transition-colors"
              >
                Reset Profile
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Content: Logs & Jobs */}
      <main className="flex-1 flex flex-col min-h-screen bg-slate-50 overflow-hidden">
        {/* Job Grid Area */}
        <div className="flex-1 p-6 overflow-y-auto">
          {jobs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
              <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center text-slate-400">
                <IconSearch />
              </div>
              <div>
                <h3 className="text-lg font-semibold">No Jobs Found Yet</h3>
                <p className="text-sm">Start the agent to scan for opportunities.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pb-20">
              {jobs.map(job => (
                <div 
                  key={job.id} 
                  className={`bg-white rounded-2xl border ${job.status === 'applied' ? 'border-emerald-200' : 'border-slate-200'} p-5 shadow-sm hover:shadow-md transition-all flex flex-col relative overflow-hidden`}
                >
                  {job.status === 'applied' && (
                    <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-tighter">
                      Applied
                    </div>
                  )}
                  
                  <div className="flex justify-between items-start mb-4">
                    <div className="space-y-1">
                      <h4 className="font-bold text-slate-800 text-lg leading-tight">{job.title}</h4>
                      <p className="text-sm font-medium text-slate-500 flex items-center space-x-1">
                        <span>{job.company}</span>
                        <span className="text-slate-300">•</span>
                        <span>{job.location}</span>
                      </p>
                    </div>
                    {job.fitScore > 0 && (
                      <div className={`flex flex-col items-center p-2 rounded-xl ${job.fitScore > 70 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                        <span className="text-xl font-black leading-none">{job.fitScore}%</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider">Fit</span>
                      </div>
                    )}
                  </div>

                  {job.matchAnalysis && (
                    <div className="mb-4 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg leading-relaxed">
                      <span className="font-bold text-slate-400 uppercase text-[9px] block mb-1">AI Match Analysis:</span>
                      {job.matchAnalysis}
                    </div>
                  )}

                  <div className="mt-auto pt-4 flex items-center justify-between border-t border-slate-50">
                    <a 
                      href={job.url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1"
                    >
                      <span>View Original Posting</span>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    </a>
                    
                    {job.status === 'applied' && (
                      <div className="flex items-center text-emerald-600 text-xs font-bold space-x-1">
                        <IconCheck />
                        <span>Submitted on {job.appliedDate}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Agent Logs Footer */}
        <div className="h-64 bg-slate-900 border-t border-slate-800 flex flex-col font-mono text-[13px] shadow-2xl relative">
          <div className="px-4 py-2 bg-slate-800 border-b border-slate-700 flex justify-between items-center text-slate-400 font-sans">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isAgentRunning ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
              <span className="text-xs font-bold uppercase tracking-widest">Agent Activity Log</span>
            </div>
            {isAgentRunning && <span className="text-[10px] text-emerald-400 font-bold uppercase animate-pulse">Running Autonomous Process</span>}
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-1">
            {logs.length === 0 ? (
              <div className="text-slate-600 italic">Initialize agent to see live activity...</div>
            ) : (
              logs.map(log => (
                <div key={log.id} className="flex space-x-3">
                  <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
                  <span className={`
                    ${log.type === 'success' ? 'text-emerald-400' : ''}
                    ${log.type === 'error' ? 'text-rose-400' : ''}
                    ${log.type === 'warning' ? 'text-amber-400' : ''}
                    ${log.type === 'agent' ? 'text-indigo-400 font-bold' : 'text-slate-300'}
                  `}>
                    {log.type === 'agent' ? '🤖 ' : ''}{log.message}
                  </span>
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        </div>
      </main>
    </div>
  );
}

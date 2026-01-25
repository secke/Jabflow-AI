
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { UserProfile, JobOpportunity, AgentLog } from './types';
import { extractProfileFromCV, searchJobs, analyzeJobFit, draftCoverLetter } from './geminiService';
import { countries } from './countries';

// --- Icons ---
const IconSearch = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>;
const IconBot = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>;
const IconUpload = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>;
const IconUser = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const IconCheck = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IconFile = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>;
const IconX = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IconMapPin = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>;
const IconChevronDown = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>;

export default function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [searchLocation, setSearchLocation] = useState<string>('');
  const [locationFilter, setLocationFilter] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [jobs, setJobs] = useState<JobOpportunity[]>([]);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  
  const logEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Handle outside clicks to close the dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sync searchLocation when profile is extracted, if not already set
  useEffect(() => {
    if (profile && !searchLocation) {
      setSearchLocation(profile.location || 'France');
    }
  }, [profile]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleCvUpload = async () => {
    if (!selectedFile) return;
    setIsProcessing(true);
    addLog(`Lecture de ${selectedFile.name}...`, "info");
    
    try {
      const base64Data = await fileToBase64(selectedFile);
      addLog("Analyse du document par Gemini...", "agent");
      const extractedProfile = await extractProfileFromCV(base64Data, selectedFile.type);
      setProfile(extractedProfile);
      addLog(`Profil extrait avec succès : ${extractedProfile.name}`, "success");
    } catch (error) {
      addLog("Erreur lors de l'analyse du document.", "error");
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const startJobAgent = async () => {
    if (!profile) return;
    setIsAgentRunning(true);
    addLog(`Démarrage de la recherche en ${searchLocation}...`, "agent");
    
    try {
      const foundJobs = await searchJobs(profile, searchLocation);
      setJobs(foundJobs);
      addLog(`${foundJobs.length} opportunités trouvées sur le web.`, "success");

      for (const job of foundJobs) {
        setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'analyzing' } : j));
        addLog(`Évaluation de l'offre : ${job.title}...`, "info");
        
        const { score, analysis } = await analyzeJobFit(job, profile);
        
        setJobs(prev => prev.map(j => j.id === job.id ? { 
          ...j, 
          fitScore: score, 
          matchAnalysis: analysis,
          status: score > 70 ? 'applying' : 'new' 
        } : j));

        if (score > 70) {
          addLog(`Excellent match (${score}%) ! Préparation de la candidature...`, "success");
          const coverLetter = await draftCoverLetter(job, profile);
          addLog(`Simulation d'envoi pour ${job.company}...`, "agent");
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          setJobs(prev => prev.map(j => j.id === job.id ? { 
            ...j, 
            status: 'applied', 
            coverLetter,
            appliedDate: new Date().toLocaleDateString() 
          } : j));
          addLog(`Candidature soumise avec succès !`, "success");
        }
      }
      addLog("Opération terminée avec succès.", "success");
    } catch (error) {
      addLog("L'agent a rencontré une erreur inattendue.", "error");
    } finally {
      setIsAgentRunning(false);
    }
  };

  const filteredCountries = useMemo(() => {
    return countries.filter(c => 
      c.toLowerCase().includes(locationFilter.toLowerCase())
    );
  }, [locationFilter]);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50">
      {/* Sidebar */}
      <div className="lg:w-96 bg-white border-r border-slate-200 flex flex-col p-6 space-y-8 h-screen sticky top-0 overflow-y-auto z-20">
        <header className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
            <IconBot />
          </div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
            JobFlow AI
          </h1>
        </header>

        {!profile ? (
          <div className="flex-1 flex flex-col space-y-6">
            <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 text-center">
              <p className="text-sm text-indigo-700 font-medium">Uploadez votre CV pour commencer l'aventure.</p>
            </div>

            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`flex-1 min-h-[240px] flex flex-col items-center justify-center border-2 border-dashed rounded-2xl cursor-pointer transition-all p-6 ${selectedFile ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50'}`}
            >
              <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".pdf,.txt,.doc,.docx" />
              {!selectedFile ? (
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                    <IconUpload />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-700">Sélectionner votre CV</p>
                    <p className="text-xs text-slate-400 mt-1">PDF ou Texte supporté</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center space-y-4 animate-in">
                  <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                    <IconFile />
                  </div>
                  <div className="max-w-full overflow-hidden">
                    <p className="text-sm font-bold text-indigo-700 truncate px-2">{selectedFile.name}</p>
                    <p className="text-xs text-indigo-400 mt-1">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }} className="p-2 text-slate-400 hover:text-rose-500 transition-colors">
                    <IconX />
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={handleCvUpload}
              disabled={isProcessing || !selectedFile}
              className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold flex items-center justify-center space-x-2 hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-lg shadow-indigo-100 active:scale-95"
            >
              {isProcessing ? <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" /> : <><IconBot /><span>Analyser mon CV</span></>}
            </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col space-y-6 animate-in">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-2">
                <IconUser /><span>Profil Détecté</span>
              </label>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <h2 className="text-lg font-bold text-slate-800">{profile.name}</h2>
                <p className="text-sm text-indigo-600 font-medium">{profile.title}</p>
              </div>
            </div>

            <div className="space-y-3 relative" ref={dropdownRef}>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-2">
                <IconMapPin /><span>Zone de Recherche</span>
              </label>
              
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full p-4 bg-white border border-slate-200 rounded-xl text-sm flex items-center justify-between hover:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all shadow-sm group"
              >
                <div className="flex items-center space-x-3 text-slate-700 truncate">
                  <IconMapPin />
                  <span className="truncate font-medium">{searchLocation || 'Choisir un pays...'}</span>
                </div>
                <IconChevronDown />
              </button>

              {isDropdownOpen && (
                <div className="absolute z-[100] top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in">
                  <div className="p-3 border-b border-slate-50 bg-slate-50/50">
                    <div className="relative">
                      <input 
                        autoFocus
                        type="text"
                        placeholder="Rechercher un pays..."
                        className="w-full pl-9 p-2.5 text-sm bg-white rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        value={locationFilter}
                        onChange={(e) => setLocationFilter(e.target.value)}
                      />
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                        <IconSearch />
                      </div>
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto scrollbar-thin">
                    {filteredCountries.length > 0 ? (
                      filteredCountries.map(country => (
                        <button
                          key={country}
                          className={`w-full text-left px-5 py-3 text-sm hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center justify-between ${searchLocation === country ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600'}`}
                          onClick={() => {
                            setSearchLocation(country);
                            setIsDropdownOpen(false);
                            setLocationFilter('');
                          }}
                        >
                          {country}
                          {searchLocation === country && <IconCheck />}
                        </button>
                      ))
                    ) : (
                      <div className="p-8 text-center text-xs text-slate-400 italic">Aucun pays ne correspond</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Expertises clés</label>
              <div className="flex flex-wrap gap-2">
                {profile.skills.slice(0, 8).map(skill => (
                  <span key={skill} className="px-3 py-1 bg-white border border-slate-200 text-[11px] font-semibold text-slate-500 rounded-full shadow-sm">
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-6 mt-auto">
              <button
                onClick={startJobAgent}
                disabled={isAgentRunning || !searchLocation}
                className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold flex items-center justify-center space-x-2 hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all active:scale-95 disabled:opacity-50"
              >
                {isAgentRunning ? (
                  <><div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" /><span>Agent en action...</span></>
                ) : (
                  <><IconSearch /><span>Lancer l'Agent IA</span></>
                )}
              </button>
              <button
                onClick={() => { setProfile(null); setSelectedFile(null); setJobs([]); setLogs([]); }}
                className="w-full mt-4 py-2 text-xs text-slate-400 hover:text-slate-600 font-semibold transition-colors uppercase tracking-widest"
              >
                Réinitialiser tout
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Panel */}
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <div className="flex-1 p-6 lg:p-10 overflow-y-auto">
          {jobs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-40">
              <div className="w-24 h-24 bg-slate-200 rounded-3xl flex items-center justify-center text-slate-400 rotate-12">
                <IconSearch />
              </div>
              <div className="max-w-xs">
                <h3 className="text-xl font-bold text-slate-800">Aucun résultat</h3>
                <p className="text-sm mt-2">Votre agent attend vos instructions pour scanner le web.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 pb-10">
              {jobs.map(job => (
                <div 
                  key={job.id} 
                  className={`bg-white rounded-3xl border ${job.status === 'applied' ? 'border-emerald-200 ring-4 ring-emerald-50' : 'border-slate-200'} p-6 shadow-sm hover:shadow-xl transition-all flex flex-col relative overflow-hidden group animate-in`}
                >
                  {job.status === 'applied' && (
                    <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-black px-4 py-1.5 rounded-bl-2xl uppercase tracking-widest shadow-lg">
                      Candidature Envoyée
                    </div>
                  )}
                  
                  <div className="flex justify-between items-start mb-6">
                    <div className="space-y-1 flex-1 pr-4">
                      <h4 className="font-extrabold text-slate-800 text-xl leading-snug group-hover:text-indigo-600 transition-colors">{job.title}</h4>
                      <p className="text-sm font-semibold text-slate-500 flex items-center space-x-2">
                        <span className="text-indigo-600">{job.company}</span>
                        <span className="text-slate-300">•</span>
                        <span>{job.location}</span>
                      </p>
                    </div>
                    {job.fitScore > 0 && (
                      <div className={`shrink-0 flex flex-col items-center justify-center w-16 h-16 rounded-2xl shadow-inner ${job.fitScore > 70 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                        <span className="text-2xl font-black leading-none">{job.fitScore}%</span>
                        <span className="text-[9px] font-black uppercase tracking-widest mt-1">Match</span>
                      </div>
                    )}
                  </div>

                  {job.matchAnalysis && (
                    <div className="mb-6 text-xs text-slate-600 bg-slate-50 p-4 rounded-2xl leading-relaxed border border-slate-100 italic">
                      <span className="font-black text-slate-400 uppercase text-[9px] block mb-2 not-italic">Raisonnement de l'IA :</span>
                      {job.matchAnalysis}
                    </div>
                  )}

                  <div className="mt-auto pt-6 flex items-center justify-between border-t border-slate-50">
                    <a 
                      href={job.url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-xs font-black text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-lg transition-all flex items-center space-x-2"
                    >
                      <span>VOIR L'OFFRE</span>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    </a>
                    
                    {job.status === 'applied' ? (
                      <div className="flex items-center text-emerald-600 text-[11px] font-black space-x-2 bg-emerald-50 px-3 py-2 rounded-lg">
                        <IconCheck />
                        <span>POSTULÉ LE {job.appliedDate}</span>
                      </div>
                    ) : job.status === 'analyzing' && (
                      <div className="flex items-center text-indigo-500 text-[11px] font-black space-x-2 animate-pulse">
                        <div className="w-2 h-2 bg-indigo-500 rounded-full" />
                        <span>ANALYSE...</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Logs */}
        <div className="h-64 bg-slate-900 border-t border-slate-800 flex flex-col font-mono text-[13px] shadow-2xl relative">
          <div className="px-6 py-3 bg-slate-800/50 border-b border-slate-800 flex justify-between items-center text-slate-400 font-sans">
            <div className="flex items-center space-x-3">
              <div className={`w-2.5 h-2.5 rounded-full ${isAgentRunning ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700 shadow-inner'}`} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Flux d'activité Agent</span>
            </div>
            {isAgentRunning && <span className="text-[10px] text-emerald-400 font-black uppercase animate-pulse tracking-widest">Processus Autonome Actif</span>}
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-2 scrollbar-dark">
            {logs.length === 0 ? (
              <div className="text-slate-600 italic opacity-50 select-none">Agent inactif. En attente de données CV...</div>
            ) : (
              logs.map(log => (
                <div key={log.id} className="flex space-x-4 animate-in">
                  <span className="text-slate-600 shrink-0 font-medium select-none">{log.timestamp}</span>
                  <span className={`
                    ${log.type === 'success' ? 'text-emerald-400' : ''}
                    ${log.type === 'error' ? 'text-rose-400' : ''}
                    ${log.type === 'warning' ? 'text-amber-400' : ''}
                    ${log.type === 'agent' ? 'text-indigo-400 font-bold' : 'text-slate-300'}
                  `}>
                    {log.type === 'agent' ? '● ' : ''}{log.message}
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

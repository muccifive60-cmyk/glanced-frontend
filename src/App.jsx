import React, { useState, useEffect, useCallback } from "react";
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURATION ---

// 1. SUPABASE URL
const SUPABASE_URL = "https://jufdloilsqpylfhwkchl.supabase.co";

// 2. SUPABASE KEY (Filled with your provided key)
const SUPABASE_KEY = "sb_publishable_2QZGx6CBijpoPG1nmOluVw_jynWqH7m"; 

// Initialize Supabase Client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const API_BASE = "http://localhost:3000";

// --- COMPONENTS ---
const Spinner = () => (
  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

const Notification = ({ message, type }) => {
  if (!message) return null;
  const style = type === 'error' ? 'bg-red-500/10 border-red-500 text-red-500' : 'bg-green-500/10 border-green-500 text-green-500';
  return (
    <div className={`fixed top-6 right-6 z-50 px-6 py-4 rounded-xl border backdrop-blur-md shadow-2xl animate-in fade-in slide-in-from-top-4 ${style}`}>
      <span className="text-xs font-black uppercase tracking-widest mr-2">{type === 'error' ? 'Error' : 'Success'}</span>
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
};

export default function App() {
  const [session, setSession] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");

  const [view, setView] = useState("console");
  const [notify, setNotify] = useState(null);
  const [brokers, setBrokers] = useState([]);
  const [apiUsage, setApiUsage] = useState(0);
  const [isPro, setIsPro] = useState(false);
  
  // Developer Key State
  const [apiKey, setApiKey] = useState("");
  const [copied, setCopied] = useState(false);
  
  const [qrCode, setQrCode] = useState(null);
  const [passportData, setPassportData] = useState({ name: "", origin: "" });

  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const BUSINESS_ID = 128;
  const LIMIT = 100;

  const showToast = (msg, type = "success") => {
    setNotify({ message: msg, type });
    setTimeout(() => setNotify(null), 4000);
  };

  // --- AUTH & KEY GENERATION ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if(session) generateUserApiKey(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if(session) generateUserApiKey(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Generate API Key based on User ID
  const generateUserApiKey = (userId) => {
    const key = `glance_live_${btoa(userId).substring(0, 24)}`;
    setApiKey(key);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    showToast("API Key Copied to Clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  // --- DATA SYNC ---
  const fetchData = useCallback(async () => {
    if (!session) return;
    try {
      const brokerRes = await fetch(`${API_BASE}/api/brokers`);
      if (brokerRes.ok) {
        const bData = await brokerRes.json();
        setBrokers(Array.isArray(bData) ? bData : []);
      }
      const usageRes = await fetch(`${API_BASE}/api/usage/${BUSINESS_ID}`);
      if (usageRes.ok) {
        const uData = await usageRes.json();
        setApiUsage(uData.count || 0);
      }
    } catch (err) { console.error("Sync Error", err); }
  }, [session]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // --- ACTIONS ---
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email: email, password: password, options: { data: { company_name: companyName } }
        });
        if (error) throw error;
        showToast("Success! Check email or simply login if verification is off.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        showToast("Login Successful!");
      }
    } catch (error) { showToast(error.message, "error"); } 
    finally { setLoading(false); }
  };

  const handleLogout = async () => { await supabase.auth.signOut(); setSession(null); };

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/create-checkout-session`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else { setIsPro(true); showToast("Pro Plan Activated"); }
    } catch (err) { showToast("Payment Error", "error"); setIsPro(true); } 
    finally { setLoading(false); }
  };

  const executeVerification = async () => {
    if (!isPro && apiUsage >= LIMIT) { showToast("Usage Limit Reached.", "error"); return; }
    setVerifying(true);
    try {
      const res = await fetch(`${API_BASE}/api/verify`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId: BUSINESS_ID })
      });
      if (res.ok) { const data = await res.json(); setApiUsage(data.count); showToast("Verification Processed."); }
    } catch (err) { showToast("Connection Failed.", "error"); } 
    finally { setVerifying(false); }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.target);
    const payload = Object.fromEntries(formData);
    try {
      const res = await fetch(`${API_BASE}/api/upload-broker`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      if (res.ok) { showToast("AI Agent Live!"); setView("marketplace"); fetchData(); }
    } catch (err) { showToast("Upload Failed", "error"); } 
    finally { setLoading(false); }
  };

  const generatePassport = () => {
    if(!passportData.name || !passportData.origin) { showToast("Enter Details", "error"); return; }
    setLoading(true);
    const dataString = `GLANCEID-PASSPORT|Product:${passportData.name}|Origin:${passportData.origin}|Verified:True`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(dataString)}`;
    setTimeout(() => { setQrCode(qrUrl); setLoading(false); showToast("Passport Generated"); }, 1500);
  };

  // --- LOGIN UI ---
  if (!session) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 font-sans">
        <Notification message={notify?.message} type={notify?.type} />
        <div className="bg-zinc-900 p-12 rounded-[40px] border border-zinc-800 w-full max-w-md shadow-2xl relative overflow-hidden">
           <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/20 blur-[60px] rounded-full"></div>
           <h1 className="text-3xl font-black italic mb-2 text-white text-center tracking-tighter">GLANCEID</h1>
           <p className="text-zinc-500 mb-8 text-[10px] uppercase font-bold text-center tracking-widest">Enterprise Gateway</p>
           
           <div className="flex bg-black p-1 rounded-xl mb-6 border border-zinc-800">
             <button onClick={() => setAuthMode('login')} className={`flex-1 py-3 rounded-lg text-[10px] uppercase font-bold transition ${authMode==='login' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}>Login</button>
             <button onClick={() => setAuthMode('signup')} className={`flex-1 py-3 rounded-lg text-[10px] uppercase font-bold transition ${authMode==='signup' ? 'bg-indigo-600 text-white' : 'text-zinc-500'}`}>Sign Up</button>
           </div>

           <form onSubmit={handleAuthSubmit} className="space-y-4">
             {authMode === 'signup' && <input className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-white outline-none focus:border-indigo-600 transition" placeholder="Company Name" required onChange={(e) => setCompanyName(e.target.value)} />}
             <input className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-white outline-none focus:border-indigo-600 transition" placeholder="Email Address" type="email" required onChange={(e) => setEmail(e.target.value)} />
             <input className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-white outline-none focus:border-indigo-600 transition" placeholder="Password" type="password" required onChange={(e) => setPassword(e.target.value)} />
             <button disabled={loading} className="w-full bg-white text-black py-4 rounded-2xl font-black uppercase text-xs hover:bg-zinc-200 transition shadow-lg mt-2">{loading ? "Processing..." : (authMode === 'login' ? "Secure Access" : "Create Account")}</button>
           </form>
        </div>
      </div>
    );
  }

  // --- MAIN APP UI ---
  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-indigo-900">
      <Notification message={notify?.message} type={notify?.type} />
      <nav className="p-6 border-b border-zinc-900 flex justify-between items-center bg-black/80 backdrop-blur-md sticky top-0 z-50">
        <h1 className="text-2xl font-black italic cursor-pointer" onClick={() => setView("console")}>GLANCEID</h1>
        <div className="flex gap-4 items-center">
          <button onClick={() => setView("marketplace")} className={`hidden md:block text-[10px] font-bold uppercase ${view==='marketplace'?'text-indigo-400':'text-zinc-500'}`}>Marketplace</button>
          <button onClick={() => setView("passport")} className={`hidden md:block text-[10px] font-bold uppercase ${view==='passport'?'text-indigo-400':'text-zinc-500'}`}>Passport</button>
          <button onClick={() => setView("console")} className={`text-[10px] font-bold uppercase ${view==='console'?'text-indigo-400':'text-zinc-500'}`}>Console</button>
          <button onClick={() => setView("upload")} className="bg-indigo-600 px-5 py-2 rounded-full text-[10px] font-bold uppercase">Upload AI</button>
          <button onClick={handleLogout} className="text-zinc-600 ml-2 text-[10px] uppercase font-bold">Logout</button>
        </div>
      </nav>

      <main className="p-8 max-w-7xl mx-auto">
        
        {/* --- CONSOLE VIEW (WITH DEVELOPER KEY) --- */}
        {view === "console" && (
          <div className="space-y-8 animate-in fade-in">
            <div className="flex justify-between items-end">
               <div>
                  <h2 className="text-4xl font-bold tracking-tighter">Dashboard</h2>
                  <p className="text-zinc-500 text-xs mt-2 uppercase tracking-widest">Welcome, {companyName || "Developer"}</p>
               </div>
               <div className="bg-zinc-900 border border-zinc-800 p-2 pl-6 pr-2 rounded-[24px] flex items-center gap-4">
                 <div><p className="text-[10px] text-zinc-500 uppercase font-bold">Plan</p><p className={`text-sm font-bold ${isPro ? 'text-green-500' : 'text-white'}`}>{isPro ? 'PRO' : 'FREE'}</p></div>
                 {!isPro && (<button onClick={handleUpgrade} disabled={loading} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase hover:bg-indigo-500 transition">{loading ? "..." : "Upgrade"}</button>)}
               </div>
            </div>

            {/* API KEY SECTION */}
            <div className="bg-zinc-900/50 p-8 rounded-[32px] border border-indigo-500/20 shadow-lg relative overflow-hidden">
               <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 blur-[80px] rounded-full pointer-events-none"></div>
               <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-widest mb-4">Developer API Credentials</h3>
               <p className="text-zinc-400 text-xs mb-6 max-w-lg">Use this secret key to authenticate your API requests. Treat this key like a password. Do not share it in public repositories.</p>
               
               <div className="bg-black p-4 rounded-xl border border-zinc-800 flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="flex items-center gap-4 w-full">
                     <div className="bg-zinc-900 p-2 rounded-lg"><svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path></svg></div>
                     <code className="text-zinc-300 font-mono text-sm tracking-wide break-all">{apiKey || "Generating Key..."}</code>
                  </div>
                  <button onClick={copyToClipboard} className="bg-white hover:bg-zinc-200 text-black px-6 py-3 rounded-xl text-xs font-black uppercase transition w-full md:w-auto">
                    {copied ? "Copied!" : "Copy Key"}
                  </button>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className={`p-10 rounded-[40px] border relative overflow-hidden ${!isPro && apiUsage >= LIMIT ? 'border-red-900 bg-red-900/10' : 'bg-zinc-900 border-zinc-800'}`}>
                 <h3 className="text-xs font-bold uppercase mb-8 text-zinc-500 tracking-widest">Live Usage</h3>
                 <p className="text-6xl font-black mb-4">{apiUsage} <span className="text-xl text-zinc-600">/ {isPro ? '∞' : LIMIT}</span></p>
                 <div className="w-full bg-black h-3 rounded-full overflow-hidden border border-zinc-800"><div className={`h-full transition-all duration-1000 ${!isPro && apiUsage >= LIMIT ? 'bg-red-600' : 'bg-indigo-600'}`} style={{ width: isPro ? '100%' : `${(apiUsage/LIMIT)*100}%` }} /></div>
              </div>
              <div className="bg-zinc-900 p-10 rounded-[40px] border border-zinc-800 flex flex-col justify-center items-center text-center">
                 <button disabled={verifying || (!isPro && apiUsage >= LIMIT)} onClick={executeVerification} className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${verifying ? 'bg-zinc-800' : 'bg-white text-black hover:scale-[1.02]'}`}>{verifying ? "Processing..." : "Execute Verification"}</button>
              </div>
            </div>
          </div>
        )}

        {view === "marketplace" && (
          <div className="space-y-8 animate-in fade-in">
            <h2 className="text-4xl font-bold italic tracking-tighter">AI Marketplace</h2>
            {brokers.length === 0 ? (
              <div className="py-20 border-2 border-dashed border-zinc-800 rounded-[40px] text-center"><p className="text-zinc-500 text-xs font-bold uppercase">No Agents Found</p></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {brokers.map(b => (
                  <div key={b.id} className="bg-zinc-900 p-8 rounded-[32px] border border-zinc-800 hover:border-indigo-500/30 transition shadow-lg">
                    <span className="text-[10px] bg-zinc-950 px-3 py-1 rounded-full uppercase font-bold text-indigo-400 border border-indigo-500/20">{b.category}</span>
                    <h3 className="text-xl font-bold mt-4 text-white">{b.name}</h3>
                    <div className="mt-6 border-t border-zinc-800 pt-6 flex justify-between items-center"><span className="text-2xl font-black">${b.price}</span><button className="bg-white text-black px-4 py-2 rounded-xl text-[10px] font-black uppercase">Hire</button></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === "upload" && (
          <div className="max-w-2xl mx-auto animate-in slide-in-from-bottom-4">
            <div className="bg-zinc-900 p-12 rounded-[40px] border border-zinc-800 shadow-2xl">
              <h2 className="text-3xl font-bold mb-8 text-indigo-400 italic">Publish AI</h2>
              <form onSubmit={handleUpload} className="space-y-5">
                <input name="name" required className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white outline-none" placeholder="Agent Name" />
                <div className="grid grid-cols-2 gap-4">
                   <input name="price" required type="number" className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white outline-none" placeholder="Fee ($)" />
                   <select name="category" className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-zinc-400 outline-none"><option>Logistics</option><option>Audit</option><option>Legal</option></select>
                </div>
                <input name="endpoint" required className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white outline-none" placeholder="API Endpoint" />
                <button disabled={loading} className="w-full bg-indigo-600 py-5 rounded-3xl font-black text-xs uppercase tracking-widest mt-4">{loading ? "..." : "Launch Agent"}</button>
              </form>
            </div>
          </div>
        )}

        {view === "passport" && (
          <div className="max-w-4xl mx-auto animate-in slide-in-from-bottom-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-zinc-900 p-10 rounded-[40px] border border-zinc-800 shadow-2xl">
                    <h2 className="text-3xl font-bold mb-6">Product Details</h2>
                    <div className="space-y-5">
                        <input className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white outline-none focus:border-indigo-600 transition" placeholder="Product GTIN / Name" onChange={(e) => setPassportData({...passportData, name: e.target.value})} />
                        <input className="w-full bg-black border border-zinc-800 p-5 rounded-2xl text-white outline-none focus:border-indigo-600 transition" placeholder="Origin (Country/Region)" onChange={(e) => setPassportData({...passportData, origin: e.target.value})} />
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-black border border-zinc-800 p-4 rounded-2xl text-zinc-500 text-xs font-bold uppercase text-center hover:border-indigo-500 cursor-pointer">Upload Cert</div>
                            <div className="bg-black border border-zinc-800 p-4 rounded-2xl text-zinc-500 text-xs font-bold uppercase text-center hover:border-indigo-500 cursor-pointer">Upload Report</div>
                        </div>
                        <button onClick={generatePassport} disabled={loading} className="w-full bg-white text-black py-5 rounded-3xl font-black text-xs uppercase tracking-widest mt-4 hover:bg-zinc-200 transition">{loading ? "Generating..." : "Generate ID & QR"}</button>
                    </div>
                </div>
                <div className="bg-indigo-600 p-10 rounded-[40px] shadow-2xl flex flex-col items-center justify-center text-center relative overflow-hidden">
                    {qrCode ? (
                        <div className="animate-in zoom-in duration-500">
                            <div className="bg-white p-4 rounded-2xl shadow-xl mb-6 inline-block"><img src={qrCode} alt="Product QR" className="w-48 h-48 mix-blend-multiply" /></div>
                            <h3 className="text-2xl font-black text-white mb-2">PASSPORT ACTIVE</h3>
                            <p className="text-indigo-200 text-xs uppercase font-bold tracking-widest">Scan to Verify Authenticity</p>
                        </div>
                    ) : (
                        <div className="opacity-50">
                            <div className="w-48 h-48 border-4 border-dashed border-indigo-400 rounded-2xl mb-6 flex items-center justify-center"><span className="text-indigo-200 font-bold uppercase text-xs">QR PlaceHolder</span></div>
                            <p className="text-indigo-200 text-xs uppercase font-bold tracking-widest">Waiting for Data...</p>
                        </div>
                    )}
                </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
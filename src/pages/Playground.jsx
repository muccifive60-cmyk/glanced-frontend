import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Send, 
  Bot, 
  User, 
  Trash2, 
  Camera, 
  Image as ImageIcon, 
  X, 
  Menu, 
  MessageSquare, 
  Loader2, 
  RefreshCw 
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Playground() {
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [attachedImage, setAttachedImage] = useState(null);
  
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // --- INITIALIZATION ---
  useEffect(() => { 
    fetchGlobalAgents(); 
    fetchChatHistory(); 
  }, []);

  useEffect(() => { 
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); 
  }, [messages, loading]);

  // --- 1. FETCH AGENTS (Directly from Supabase for speed & reliability) ---
  async function fetchGlobalAgents() {
    try {
      // We fetch directly from Supabase to ensure the UI loads fast
      const { data, error } = await supabase
        .from('ai_models')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;

      // Formatting data for the UI
      const formattedModels = data.map(agent => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        category: agent.category,
        system_prompt: agent.system_prompt, // Important: We need this for the AI persona
        provider: agent.provider || 'GlanceID'
      }));

      setModels(formattedModels);
      
      // Select the first model by default if none selected
      if (!selectedModel && formattedModels.length > 0) {
        setSelectedModel(formattedModels[0]);
      }
    } catch (error) {
      console.error("Error loading agents:", error);
      // Fallback
      setModels([{ 
        id: 'fallback', 
        name: 'Standard AI', 
        description: 'System is offline, using standard fallback.', 
        system_prompt: 'You are a helpful assistant.' 
      }]);
    }
  }

  // --- 2. FETCH HISTORY FROM SUPABASE ---
  async function fetchChatHistory() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { data } = await supabase
      .from('chat_history')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
      
    if (data) setMessages(data);
  }

  // --- 3. SEND MESSAGE TO RENDER SERVER ---
  async function handleSend(e) {
    e.preventDefault();
    if ((!input.trim() && !attachedImage) || !selectedModel) return;
    
    const text = input;
    const image = attachedImage;
    
    // Clear Input & Set Loading
    setInput('');
    setAttachedImage(null);
    setLoading(true);
    
    // Optimistic UI Update (Show user message immediately)
    const userMsg = { role: 'user', content: text, image };
    setMessages(prev => [...prev, userMsg]);

    // Get Current User
    const { data: { user } } = await supabase.auth.getUser();

    try {
      // A. Save User Message to Supabase History
      if (user) {
        await supabase.from('chat_history').insert({ 
          user_id: user.id, 
          role: 'user', 
          content: text + (image ? ' [Image Attached]' : ''), 
          model_id: selectedModel.id 
        });
      }

      // B. Prepare the Request Body
      // We send the 'agent_config' so the Backend knows exactly who to roleplay
      const payload = {
        model: "gemini-1.5-flash", // Using the standard high-speed model
        messages: [...messages, { role: 'user', content: text }], // Send history context
        agent_config: {
          name: selectedModel.name,
          category: selectedModel.category,
          description: selectedModel.description,
          system_prompt: selectedModel.system_prompt
        }
      };

      // C. Send Request to Render Backend
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://glanceid-backend.onrender.com';
      
      const response = await fetch(`${backendUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // If you implement API Keys later, uncomment below:
          // 'Authorization': `Bearer ${user?.id}` 
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Server error');
      }

      const data = await response.json();
      
      // Extract Reply
      const aiReply = data.choices?.[0]?.message?.content || "No response generated.";

      // D. Save AI Reply to Supabase History
      if (user) {
        await supabase.from('chat_history').insert({ 
          user_id: user.id, 
          role: 'assistant', 
          content: aiReply, 
          model_id: selectedModel.id 
        });
      }
      
      // Update UI with AI Reply
      setMessages(prev => [...prev, { role: 'assistant', content: aiReply }]);

    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { 
        role: 'system', 
        content: `⚠️ Error: ${err.message}. Please check if the Backend is running.` 
      }]);
    } finally { 
      setLoading(false); 
    }
  }

  // --- UI RENDER ---
  return (
    <div className="flex h-[calc(100vh-80px)] bg-slate-950 text-white overflow-hidden relative font-sans">
      {/* Hidden File Input */}
      <input type="file" ref={fileInputRef} accept="image/*" onChange={e => {
          const file = e.target.files?.[0]; 
          if(file) { 
            const r = new FileReader(); 
            r.onloadend = () => setAttachedImage(r.result); 
            r.readAsDataURL(file); 
          }
      }} className="hidden" />

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="absolute inset-0 z-50 bg-slate-900/95 p-4 pt-12 md:hidden backdrop-blur-sm transition-all">
          <button onClick={()=>setIsSidebarOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X/></button>
          <h2 className="text-sm font-bold text-indigo-400 mb-6 tracking-wider uppercase">Select Agent</h2>
          <div className="overflow-y-auto h-full pb-20 space-y-2">
            {models.map(m => (
              <button key={m.id} onClick={()=>{setSelectedModel(m);setIsSidebarOpen(false); setMessages([])}} className="w-full text-left p-4 border border-slate-800 rounded-xl bg-slate-800/50 hover:bg-indigo-600/20 hover:border-indigo-500 transition-all">
                <div className="font-bold text-white">{m.name}</div>
                <div className="text-xs text-slate-400 truncate mt-1">{m.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <div className="w-80 bg-slate-900 border-r border-slate-800 p-4 hidden md:flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xs font-bold text-slate-500 tracking-wider">AVAILABLE AGENTS</h2>
          <span className="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-400">{models.length} Online</span>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
          {models.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-500 space-y-3">
              <Loader2 className="animate-spin" size={24}/>
              <span className="text-sm">Connecting to Matrix...</span>
            </div>
          ) : (
            models.map(m => (
              <button 
                key={m.id} 
                onClick={() => { setSelectedModel(m); setMessages([]); }} 
                className={`w-full text-left p-3 rounded-lg transition-all border ${
                  selectedModel?.id === m.id 
                  ? 'bg-indigo-600/10 border-indigo-500 text-white shadow-[0_0_15px_rgba(79,70,229,0.1)]' 
                  : 'border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <div className="font-medium text-sm">{m.name}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-500 border border-slate-700">{m.category || 'General'}</span>
                  <span className="text-[10px] opacity-60 truncate max-w-[120px]">{m.description}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative bg-slate-950">
        {/* Header */}
        <div className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
            <div className="flex gap-3 items-center">
              <button onClick={()=>setIsSidebarOpen(true)} className="md:hidden text-slate-400 hover:text-white"><Menu/></button>
              <div>
                <span className="font-bold block text-white text-lg">{selectedModel?.name || 'GlanceID Workspace'}</span>
                <div className="flex items-center gap-2">
                   <div className={`w-2 h-2 rounded-full ${selectedModel ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`}></div>
                   <span className="text-xs text-slate-400 hidden md:block">
                     {selectedModel ? 'System Active • Ready for query' : 'Select an agent to begin'}
                   </span>
                </div>
              </div>
            </div>
            <Link to="/marketplace" className="text-xs font-semibold bg-white text-black hover:bg-gray-200 px-5 py-2 rounded-full transition shadow-[0_0_15px_rgba(255,255,255,0.1)]">
              Browse Agents
            </Link>
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-60 animate-in fade-in duration-700">
                <Bot size={64} className="mb-6 text-slate-700"/>
                <p className="text-lg font-medium text-slate-500">Select an specialized agent</p>
                <p className="text-sm">and start your session.</p>
              </div>
            )}
            
            {messages.map((m,i) => (
              <div key={i} className={`flex gap-4 ${m.role==='user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
                
                {/* AI Avatar */}
                {m.role !== 'user' && (
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 flex-shrink-0 mt-1">
                    <Bot size={18}/>
                  </div>
                )}
                
                {/* Message Bubble */}
                <div className={`p-4 rounded-2xl max-w-[85%] md:max-w-[70%] text-sm leading-relaxed shadow-sm ${
                  m.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-br-none shadow-[0_4px_15px_rgba(79,70,229,0.3)]' 
                    : 'bg-slate-900 text-slate-200 rounded-bl-none border border-slate-800'
                }`}>
                  {m.image && (
                    <div className="mb-3 overflow-hidden rounded-lg border border-white/10">
                      <img src={m.image} alt="attachment" className="max-w-full object-cover"/>
                    </div>
                  )}
                  {/* Handle new lines correctly */}
                  <div className="whitespace-pre-wrap font-light tracking-wide">{m.content}</div>
                </div>

                {/* User Avatar */}
                {m.role === 'user' && (
                  <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 flex-shrink-0 mt-1">
                    <User size={18}/>
                  </div>
                )}
              </div>
            ))}
            
            {/* Loading Indicator */}
            {loading && (
              <div className="flex gap-4 justify-start animate-pulse">
                 <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mt-1">
                    <Bot size={18}/>
                 </div>
                 <div className="bg-slate-900 px-4 py-3 rounded-2xl rounded-bl-none border border-slate-800 flex items-center gap-2">
                    <Loader2 className="animate-spin text-indigo-500" size={16}/>
                    <span className="text-xs text-slate-500">Processing response...</span>
                 </div>
              </div>
            )}
            
            {/* Invisible div to scroll to */}
            <div ref={messagesEndRef}/>
        </div>

        {/* Input Area */}
        <div className="p-4 bg-slate-950 border-t border-slate-800">
            <form onSubmit={handleSend} className="max-w-4xl mx-auto relative">
                
                {/* Image Preview Overlay */}
                {attachedImage && (
                  <div className="absolute -top-20 left-0 bg-slate-900 p-2 rounded-xl border border-slate-700 flex items-center gap-3 shadow-2xl animate-in slide-in-from-bottom-2">
                    <img src={attachedImage} className="h-12 w-12 rounded-lg object-cover border border-slate-600"/>
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-300">Image attached</span>
                      <span className="text-[10px] text-slate-500">Ready to send</span>
                    </div>
                    <button type="button" onClick={()=>setAttachedImage(null)} className="p-1 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-full transition ml-2">
                      <X size={14}/>
                    </button>
                  </div>
                )}
                
                <div className="flex gap-3 items-end bg-slate-900/50 p-2 rounded-2xl border border-slate-800 focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all">
                  
                  {/* Attachment Button */}
                  <button 
                    type="button" 
                    onClick={()=>fileInputRef.current.click()} 
                    className="p-3 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition tooltip"
                    title="Attach Image"
                  >
                    <ImageIcon size={20}/>
                  </button>
                  
                  {/* Text Input */}
                  <div className="flex-1">
                    <textarea 
                      value={input} 
                      onChange={e=>setInput(e.target.value)} 
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend(e);
                        }
                      }}
                      className="w-full bg-transparent border-none text-slate-200 placeholder:text-slate-600 focus:ring-0 px-2 py-3 outline-none resize-none max-h-32 min-h-[44px]" 
                      placeholder={selectedModel ? `Ask ${selectedModel.name} anything...` : "Select an agent to start chatting..."}
                      disabled={!selectedModel}
                      rows={1}
                    />
                  </div>
                  
                  {/* Send Button */}
                  <button 
                    type="submit" 
                    disabled={loading || (!input.trim() && !attachedImage)}
                    className={`p-3 rounded-xl flex items-center justify-center transition-all duration-300 ${
                      loading || (!input.trim() && !attachedImage) 
                      ? 'bg-slate-800 text-slate-600 cursor-not-allowed' 
                      : 'bg-indigo-600 text-white hover:bg-indigo-500 hover:scale-105 shadow-lg shadow-indigo-600/20'
                    }`}
                  >
                    {loading ? <Loader2 className="animate-spin" size={20}/> : <Send size={20}/>}
                  </button>
                </div>
                
                <div className="text-center mt-2">
                  <p className="text-[10px] text-slate-600">
                    AI can make mistakes. Verify important information. | GlanceID Secure Chat
                  </p>
                </div>
            </form>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { Send, Bot, User, Trash2, Camera, Image as ImageIcon, X, Menu, MessageSquare, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Playground() {
  const [models, setModels] = useState([])
  const [selectedModel, setSelectedModel] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [attachedImage, setAttachedImage] = useState(null)
  
  const fileInputRef = useRef(null)
  const messagesEndRef = useRef(null)

  useEffect(() => { 
    fetchGlobalAgents(); 
    fetchChatHistory(); 
  }, [])

  useEffect(() => { 
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) 
  }, [messages])

  // --- 1. FETCH AGENTS FROM YOUR RENDER SERVER ---
  async function fetchGlobalAgents() {
    try {
      // Fetching directly from your backend (The 800k agents logic)
      const response = await fetch('https://glanceid-backend.onrender.com/agents?limit=50');
      if (!response.ok) throw new Error('Failed to fetch agents');
      
      const data = await response.json();
      
      // Formatting data for the UI
      const formattedModels = data.map(agent => ({
        id: agent.name, // Using name as ID for consistency with backend logic
        name: agent.name,
        description: agent.description,
        provider: agent.provider || 'GlanceID'
      }));

      setModels(formattedModels);
      
      // Select the first model by default if none selected
      if (!selectedModel && formattedModels.length > 0) {
        setSelectedModel(formattedModels[0]);
      }
    } catch (error) {
      console.error("Error loading agents:", error);
      // Fallback in case server is down
      setModels([{ id: 'gpt-4o', name: 'GPT-4o (Fallback)', description: 'Standard AI' }]);
    }
  }

  // --- 2. FETCH HISTORY FROM SUPABASE (UNCHANGED) ---
  async function fetchChatHistory() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    
    const { data } = await supabase
      .from('chat_history')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      
    if (data) setMessages(data)
  }

  // --- 3. SEND MESSAGE TO RENDER SERVER ---
  async function handleSend(e) {
    e.preventDefault()
    if ((!input.trim() && !attachedImage) || !selectedModel) return
    
    const text = input
    const image = attachedImage
    
    // Clear Input & Set Loading
    setInput('')
    setAttachedImage(null)
    setLoading(true)
    
    // Optimistic UI Update
    const userMsg = { role: 'user', content: text, image }
    setMessages(prev => [...prev, userMsg])

    // Get Current User
    const { data: { user } } = await supabase.auth.getUser()

    try {
      // A. Save User Message to Supabase History
      if (user) {
        await supabase.from('chat_history').insert({ 
          user_id: user.id, 
          role: 'user', 
          content: text + (image ? ' [Image]' : ''), 
          model_id: selectedModel.id 
        })
      }

      // B. Fetch API Key for the User (Required by your Server)
      // We need to send the API Key to the backend to authorize the request
      let apiKey = '';
      if (user) {
        const { data: keyData } = await supabase
          .from('api_keys')
          .select('key')
          .eq('user_id', user.id)
          .single();
        apiKey = keyData?.key;
      }

      // C. Send Request to Render Backend (server.js)
      // This triggers the "Persona Injection" logic we built
      const response = await fetch('https://glanceid-backend.onrender.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}` // Sending the user's key
        },
        body: JSON.stringify({
          model: selectedModel.name, // Sends "Elite Navigator..."
          messages: [{ role: 'user', content: text }]
        })
      });

      const data = await response.json();
      
      // Extract Reply
      // Note: Adjusting based on standard OpenAI format or your server response
      const aiReply = data.choices?.[0]?.message?.content || data.reply || "No response from agent.";

      // D. Save AI Reply to Supabase History
      if (user) {
        await supabase.from('chat_history').insert({ 
          user_id: user.id, 
          role: 'assistant', // changed 'ai' to 'assistant' for standard convention
          content: aiReply, 
          model_id: selectedModel.id 
        })
      }
      
      // Update UI with AI Reply
      setMessages(prev => [...prev, { role: 'assistant', content: aiReply }])

    } catch (err) {
      console.error(err)
      setMessages(prev => [...prev, { role: 'system', content: 'Connection Error: Ensure Server is Live and you have an active API Key.' }])
    } finally { 
      setLoading(false) 
    }
  }

  // --- UI RENDER (UNCHANGED LAYOUT) ---
  return (
    <div className="flex h-[calc(100vh-80px)] bg-slate-950 text-white overflow-hidden relative font-sans">
      <input type="file" ref={fileInputRef} onChange={e => {
          const file = e.target.files?.[0]; 
          if(file) { 
            const r = new FileReader(); 
            r.onloadend = () => setAttachedImage(r.result); 
            r.readAsDataURL(file) 
          }
      }} className="hidden" />

      {/* Mobile Sidebar */}
      {isSidebarOpen && (
        <div className="absolute inset-0 z-50 bg-slate-900 p-4 pt-12 md:hidden">
          <button onClick={()=>setIsSidebarOpen(false)} className="absolute top-4 right-4"><X/></button>
          <div className="overflow-y-auto h-full pb-10">
            {models.map(m => (
              <button key={m.id} onClick={()=>{setSelectedModel(m);setIsSidebarOpen(false)}} className="w-full text-left p-4 border border-slate-800 mb-2 rounded bg-slate-800">
                <div className="font-bold text-indigo-400">{m.name}</div>
                <div className="text-xs text-slate-400 truncate">{m.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <div className="w-72 bg-slate-900 border-r border-slate-800 p-4 hidden md:flex flex-col">
        <h2 className="text-xs font-bold text-slate-400 mb-4 tracking-wider">AVAILABLE AGENTS</h2>
        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {models.length === 0 ? (
            <div className="text-slate-500 text-sm text-center mt-10">Loading Agents...</div>
          ) : (
            models.map(m => (
              <button 
                key={m.id} 
                onClick={() => setSelectedModel(m)} 
                className={`w-full text-left p-3 rounded transition-all ${selectedModel?.id===m.id ? 'bg-indigo-600/20 border border-indigo-500/50 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
              >
                <div className="font-medium text-sm">{m.name}</div>
                <div className="text-[10px] opacity-60 truncate">{m.description}</div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative">
        {/* Header */}
        <div className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur">
            <div className="flex gap-3 items-center">
              <button onClick={()=>setIsSidebarOpen(true)} className="md:hidden text-slate-400"><Menu/></button>
              <div>
                <span className="font-bold block text-white">{selectedModel?.name || 'Select Agent'}</span>
                <span className="text-xs text-slate-400 hidden md:block">{selectedModel?.description ? selectedModel.description.substring(0, 60) + '...' : 'AI System Ready'}</span>
              </div>
            </div>
            <Link to="/marketplace" className="text-xs font-medium bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-full transition">
              Marketplace
            </Link>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-50">
                <Bot size={48} className="mb-4"/>
                <p>Select an agent and start navigating.</p>
              </div>
            )}
            
            {messages.map((m,i) => (
              <div key={i} className={`flex gap-3 ${m.role==='user' ? 'justify-end' : 'justify-start'}`}>
                {m.role !== 'user' && <div className="w-8 h-8 rounded-full bg-indigo-600/20 flex items-center justify-center text-indigo-400 flex-shrink-0"><Bot size={16}/></div>}
                
                <div className={`p-4 rounded-2xl max-w-[85%] md:max-w-[70%] text-sm leading-relaxed ${
                  m.role==='user' 
                    ? 'bg-indigo-600 text-white rounded-br-none' 
                    : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'
                }`}>
                  {m.image && <img src={m.image} alt="attachment" className="rounded-lg mb-3 max-w-full border border-slate-600"/>}
                  <div className="whitespace-pre-wrap">{m.content}</div>
                </div>

                {m.role === 'user' && <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 flex-shrink-0"><User size={16}/></div>}
              </div>
            ))}
            
            {loading && (
              <div className="flex gap-3 justify-start">
                 <div className="w-8 h-8 rounded-full bg-indigo-600/20 flex items-center justify-center text-indigo-400"><Bot size={16}/></div>
                 <div className="bg-slate-800 p-4 rounded-2xl rounded-bl-none border border-slate-700 flex items-center">
                    <Loader2 className="animate-spin text-slate-400" size={18}/>
                 </div>
              </div>
            )}
            <div ref={messagesEndRef}/>
        </div>

        {/* Input Area */}
        <form onSubmit={handleSend} className="p-4 bg-slate-900 border-t border-slate-800 relative">
            {attachedImage && (
              <div className="absolute -top-16 left-4 bg-slate-800 p-2 rounded-lg border border-slate-700 flex items-center gap-2 shadow-xl">
                <img src={attachedImage} className="h-10 w-10 rounded object-cover"/>
                <button type="button" onClick={()=>setAttachedImage(null)} className="text-red-400 hover:text-red-300"><X size={16}/></button>
              </div>
            )}
            
            <div className="flex gap-3 max-w-4xl mx-auto">
              <button type="button" onClick={()=>fileInputRef.current.click()} className="p-3 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition">
                <ImageIcon size={20}/>
              </button>
              
              <div className="flex-1 relative">
                <input 
                  value={input} 
                  onChange={e=>setInput(e.target.value)} 
                  className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-3 outline-none transition" 
                  placeholder={selectedModel ? `Message ${selectedModel.name}...` : "Select an agent to start..."}
                  disabled={!selectedModel}
                />
              </div>
              
              <button 
                type="submit" 
                disabled={loading || (!input.trim() && !attachedImage)}
                className={`px-6 rounded-xl flex items-center justify-center transition ${
                  loading || (!input.trim() && !attachedImage) 
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                  : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/20'
                }`}
              >
                {loading ? <Loader2 className="animate-spin" size={20}/> : <Send size={20}/>}
              </button>
            </div>
        </form>
      </div>
    </div>
  )
}
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { Send, Bot, User, Trash2, Link as LinkIcon, Phone, PhoneOff, Mic } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Playground() {
  // --- STATE MANAGEMENT ---
  const [models, setModels] = useState([])
  const [selectedModel, setSelectedModel] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  
  // --- VOICE STATE ---
  const [isTalking, setIsTalking] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState('Loading Voice...')
  const [vapiReady, setVapiReady] = useState(false)
  
  const messagesEndRef = useRef(null)
  // Use a ref for Vapi to prevent re-renders and build crashes
  const vapiRef = useRef(null)

  // --- 1. INITIALIZATION & EFFECTS ---
  useEffect(() => {
    fetchLibraryModels()
    fetchChatHistory()
    
    // Initialize Vapi dynamically to prevent "Object is not a constructor" error
    initializeVapi()

    // Cleanup when component unmounts
    return () => {
      if (vapiRef.current) {
        vapiRef.current.stop()
      }
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // --- SAFE VAPI LOADING (FIX) ---
  async function initializeVapi() {
    try {
      // Dynamic import: Loads Vapi only after the page has started rendering
      const VapiModule = await import('@vapi-ai/web');
      const VapiClass = VapiModule.default || VapiModule;
      
      const vapiKey = import.meta.env.VITE_VAPI_PUBLIC_KEY;
      
      if (!vapiKey) {
        console.warn("Vapi Public Key is missing in environment variables.");
        setVoiceStatus("Voice Config Error");
        return;
      }

      // Initialize Instance
      const vapiInstance = new VapiClass(vapiKey);
      vapiRef.current = vapiInstance;

      // Event Listeners
      vapiInstance.on('call-start', () => {
        setIsTalking(true)
        setVoiceStatus('Voice Connected')
      })

      vapiInstance.on('call-end', () => {
        setIsTalking(false)
        setVoiceStatus('Voice Ready')
      })

      vapiInstance.on('error', (e) => {
        console.error("Vapi Error:", e)
        setVoiceStatus('Connection Error')
        setIsTalking(false)
      })
      
      setVapiReady(true)
      setVoiceStatus('Voice Ready')

    } catch (err) {
      console.error("Failed to load Vapi SDK:", err);
      setVoiceStatus("Voice Failed to Load");
    }
  }

  // --- 2. DATA FETCHING (Supabase) ---

  // Fetch models from the User's Library
  async function fetchLibraryModels() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('user_models')
        .select(`
          ai_models (
            *
          )
        `)
        .eq('user_id', user.id)

      if (error) {
        console.error('Error fetching library:', error)
        return
      }

      if (data) {
        // Flatten the structure: user_models -> ai_models
        const libraryModels = data.map(item => item.ai_models).filter(Boolean)
        setModels(libraryModels)
        
        if (libraryModels.length > 0 && !selectedModel) {
          setSelectedModel(libraryModels[0])
        }
      }
    } catch (err) {
      console.error("Supabase Error:", err)
    }
  }

  // Load Previous Chats
  async function fetchChatHistory() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('chat_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true }) 

      if (data) setMessages(data)
    } catch (err) {
      console.error("History Error:", err)
    }
  }

  // --- 3. ACTIONS ---

  // Voice Call Toggle
  const toggleCall = () => {
    if (!vapiRef.current || !vapiReady) {
      alert("Voice service is still initializing. Please wait.");
      return;
    }

    if (isTalking) {
      vapiRef.current.stop()
    } else {
      setVoiceStatus('Connecting...')
      // Using the specific Assistant ID provided
      vapiRef.current.start('be1bcb56-7536-493b-bd99-52e041d8e950')
        .catch(err => {
             console.error("Call failed:", err);
             setVoiceStatus("Call Failed");
        });
    }
  }

  // Clear Chat Function
  async function clearChat() {
    if (!confirm("Delete all chat history?")) return
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
        await supabase.from('chat_history').delete().eq('user_id', user.id)
        setMessages([])
    }
  }

  // Send Text Message Function
  async function handleSend(e) {
    e.preventDefault()
    if (!input.trim() || !selectedModel) return

    const userText = input
    setInput('') // Clear input immediately
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()

    // Save User Message to DB
    if (user) {
      await supabase.from('chat_history').insert({
        user_id: user.id,
        role: 'user',
        content: userText,
        model_id: selectedModel.id
      })
    }

    // Update UI immediately
    setMessages(prev => [...prev, { role: 'user', content: userText }])

    try {
      // Call AI Engine (Supabase Edge Function)
      const { data: engineData, error } = await supabase.functions.invoke('chat-engine', {
        body: { message: userText, model_id: selectedModel.id }
      })

      if (error) throw error

      const aiReply = engineData.reply

      // Save AI Reply to DB
      if (user) {
        await supabase.from('chat_history').insert({
          user_id: user.id,
          role: 'ai',
          content: aiReply,
          model_id: selectedModel.id
        })
      }

      setMessages(prev => [...prev, { role: 'ai', content: aiReply }])

    } catch (err) {
      console.error(err)
      setMessages(prev => [...prev, { role: 'system', content: "Error: Failed to get response." }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-80px)] bg-slate-950 overflow-hidden">
      {/* SIDEBAR LIST */}
      <div className="w-72 border-r border-slate-800 bg-slate-900 p-4 hidden md:flex flex-col">
        <h2 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4 flex items-center justify-between">
           My Library
           <Link to="/marketplace" className="text-indigo-400 hover:text-white text-xs flex items-center gap-1">
             + Add
           </Link>
        </h2>
        
        <div className="space-y-2 overflow-y-auto flex-1">
          {models.length === 0 && (
            <div className="text-slate-500 text-sm italic p-2">
              No models in library. Go to Marketplace to add one.
            </div>
          )}
          
          {models.map(model => (
            <button
              key={model.id}
              onClick={() => setSelectedModel(model)}
              className={`w-full text-left p-3 rounded-lg transition border ${
                selectedModel?.id === model.id ? 'bg-indigo-600/20 border-indigo-500 text-white' : 'bg-slate-800/50 border-transparent text-slate-400 hover:bg-slate-800'
              }`}
            >
              <div className="font-medium truncate">{model.name}</div>
              <div className="text-xs opacity-70 flex justify-between mt-1">
                <span>{model.provider || 'AI Agent'}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* CHAT AREA */}
      <div className="flex-1 flex flex-col relative">
        {/* Header */}
        <div className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${isTalking ? 'bg-green-400 animate-pulse' : (selectedModel ? 'bg-green-500' : 'bg-red-500')}`} />
            <div>
              <h3 className="font-bold text-white flex items-center gap-2">
                {selectedModel ? selectedModel.name : 'Select a Model from Library'}
                {isTalking && <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full border border-green-500/50">Live</span>}
              </h3>
              {/* Show Voice Status */}
              <p className="text-xs text-green-400/80">{voiceStatus}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Call Button */}
            <button 
              onClick={toggleCall}
              disabled={!vapiReady}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                isTalking 
                  ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/50' 
                  : 'bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-900/20 disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
            >
              {isTalking ? <PhoneOff size={18} /> : <Phone size={18} />}
              <span className="hidden sm:inline">{isTalking ? 'End Call' : 'Call Agent'}</span>
            </button>

            <div className="h-6 w-px bg-slate-700 mx-2"></div>

            <button onClick={clearChat} className="text-slate-400 hover:text-red-400 transition p-2 hover:bg-slate-800 rounded-lg" title="Clear History">
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
          {messages.length === 0 && !isTalking && (
             <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-50">
                <Bot size={48} className="mb-4"/>
                <p>Start a conversation...</p>
             </div>
          )}

          {/* Voice Active Indicator for empty state */}
          {isTalking && messages.length === 0 && (
             <div className="flex flex-col items-center justify-center h-full">
                <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center animate-pulse mb-4">
                  <Mic size={40} className="text-green-500" />
                </div>
                <p className="text-slate-300">Listening...</p>
             </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role !== 'user' && <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center shrink-0"><Bot size={16} className="text-white" /></div>}
              
              <div className={`max-w-[80%] p-4 rounded-2xl whitespace-pre-wrap ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'}`}>
                {msg.content}
              </div>

              {msg.role === 'user' && <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0"><User size={16} className="text-slate-300" /></div>}
            </div>
          ))}
          
          {loading && (
            <div className="flex gap-4">
               <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center shrink-0"><Bot size={16} className="text-white" /></div>
               <div className="bg-slate-800 p-4 rounded-2xl text-slate-400 animate-pulse text-sm">Thinking...</div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 bg-slate-900 border-t border-slate-800">
          <form onSubmit={handleSend} className="max-w-4xl mx-auto relative flex items-center gap-4">
            <input 
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              disabled={loading || !selectedModel || isTalking} 
              placeholder={isTalking ? "Voice mode active..." : (selectedModel ? `Message ${selectedModel.name}...` : "Select a model from library first...")}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl py-4 pl-6 pr-12 text-white focus:border-indigo-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed" 
            />
            <button type="submit" disabled={!input.trim() || loading || isTalking} className="absolute right-2 p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition disabled:bg-slate-700 disabled:opacity-50"><Send size={20} /></button>
          </form>
        </div>
      </div>
    </div>
  )
}

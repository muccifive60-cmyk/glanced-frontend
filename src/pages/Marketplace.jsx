import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import {
  Send, Bot, User, Trash2, Phone, PhoneOff, Camera, Image as ImageIcon, X, Menu
} from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Playground() {
  // ------------------ STATE MANAGEMENT ------------------
  const [models, setModels] = useState([])
  const [selectedModel, setSelectedModel] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  // Image Handling
  const [attachedImage, setAttachedImage] = useState(null)
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)

  // Voice Call State
  const [isTalking, setIsTalking] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState('Initializing...')
  
  const messagesEndRef = useRef(null)
  const vapiRef = useRef(null)
  
  // Ref for tracking selected model
  const selectedModelRef = useRef(null)

  // ==================================================================================
  // ⚠️ CONFIGURATION (HARDCODED KEYS)
  const VAPI_PUBLIC_KEY = '150fa8ac-12a5-48fb-934f-0a9bbadc2da7'
  const VAPI_ASSISTANT_ID = 'Be1bcb56-7536-493b-bca9-3261cf8e11b6'
  const MY_SUPABASE_URL = 'https://hveyemdkojlijcesvtkt.supabase.co' 
  // ==================================================================================

  // Sync Ref with State
  useEffect(() => {
    selectedModelRef.current = selectedModel
  }, [selectedModel])

  // ------------------ INITIALIZATION ------------------
  useEffect(() => {
    fetchLibraryModels()
    fetchChatHistory()

    const initializeVapi = async () => {
      try {
        setVoiceStatus('Downloading Engine...')

        const module = await import("https://esm.sh/@vapi-ai/web")
        const VapiClass = module.default || module.Vapi

        if (!VapiClass) throw new Error("Vapi Class not found in module")

        const vapi = new VapiClass(VAPI_PUBLIC_KEY)
        vapiRef.current = vapi

        vapi.on('call-start', () => {
          setIsTalking(true)
          setVoiceStatus('Connected')
        })

        vapi.on('call-end', () => {
          setIsTalking(false)
          setVoiceStatus('Ready')
        })

        vapi.on('speech-start', () => {
          setVoiceStatus('Listening...')
        })

        // Auto-save Transcripts
        vapi.on('message', async (msg) => {
          if (msg.type === 'transcript' && msg.transcriptType === 'final') {
            const text = msg.transcript
            setMessages(p => [...p, { role: 'user', content: text }])

            try {
                const { data: { user } } = await supabase.auth.getUser()
                const currentModel = selectedModelRef.current 
                if (user && currentModel) {
                    await supabase.from('chat_history').insert({
                        user_id: user.id,
                        role: 'user',
                        content: text + ' [Voice]',
                        model_id: currentModel.id
                    })
                }
            } catch (err) {
                console.error("Failed to save transcript:", err)
            }
          }
        })

        vapi.on('error', (e) => {
          console.error('Vapi Error:', e)
          // Safe error handling to avoid "substring" crash
          let msg = "Unknown Error";
          try { msg = JSON.stringify(e) } catch(err) {}
          setIsTalking(false)
          setVoiceStatus(`Err: ${msg.substring(0, 40)}`)
        })

        setVoiceStatus('Ready')
      } catch (err) {
        console.error("Init Error:", err)
        setVoiceStatus(`Sys Err: ${err.message}`)
      }
    }

    initializeVapi()

    return () => {
      if (vapiRef.current) {
        vapiRef.current.stop()
        vapiRef.current.removeAllListeners() 
      }
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ------------------ DATA FETCHING ------------------
  async function fetchLibraryModels() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('user_models').select('ai_models (*)').eq('user_id', user.id)
      if (data) {
        const list = data.map(i => i.ai_models).filter(Boolean)
        setModels(list)
        if (!selectedModel && list.length) setSelectedModel(list[0])
      }
    } catch (e) { console.error(e) }
  }

  async function fetchChatHistory() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('chat_history').select('*').eq('user_id', user.id).order('created_at', { ascending: true })
      if (data) setMessages(data)
    } catch (e) { console.error(e) }
  }

  // ------------------ IMAGE HANDLING ------------------
  const handleImageSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => setAttachedImage(reader.result)
    reader.readAsDataURL(file)
  }

  const removeImage = () => {
    setAttachedImage(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
  }

  // ------------------ CALL LOGIC (FIXED) ------------------
  const toggleCall = async () => {
    if (!vapiRef.current) return

    if (!selectedModel && !isTalking) {
        alert("Please select an AI Agent first!")
        return
    }

    if (isTalking) {
      vapiRef.current.stop()
    } else {
      try {
        setVoiceStatus('Connecting...')
        const { data: { user } } = await supabase.auth.getUser()

        // ⚠️ FIX: REMOVED serverUrl. This fixes the 400 Bad Request error.
        await vapiRef.current.start(VAPI_ASSISTANT_ID, {
            variableValues: {
                userId: user?.id,
                modelId: selectedModel?.id
            }
        })
      } catch (err) {
        console.error('Start Error:', err)
        setVoiceStatus(`Start Err: ${err.message}`)
      }
    }
  }

  // ------------------ CHAT LOGIC ------------------
  async function handleSend(e) {
    e.preventDefault()
    if ((!input.trim() && !attachedImage) || !selectedModel) return
    const text = input; const image = attachedImage
    setInput(''); setAttachedImage(null); setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    
    setMessages(p => [...p, { role: 'user', content: text, image }])
    if (user) await supabase.from('chat_history').insert({ user_id: user.id, role: 'user', content: text + (image ? ' [Image]' : ''), model_id: selectedModel.id })

    try {
      const { data, error } = await supabase.functions.invoke('chat-engine', { body: { message: text, model_id: selectedModel.id } })
      if (error) throw error
      if (user) await supabase.from('chat_history').insert({ user_id: user.id, role: 'ai', content: data.reply, model_id: selectedModel.id })
      setMessages(p => [...p, { role: 'ai', content: data.reply }])
    } catch (err) {
      console.error(err)
      setMessages(p => [...p, { role: 'system', content: 'Connection Error' }])
    } finally { setLoading(false) }
  }

  async function clearChat() {
    if (!confirm('Delete history?')) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('chat_history').delete().eq('user_id', user.id)
    setMessages([])
  }

  // ------------------ UI RENDER ------------------
  return (
    <div className="flex h-[calc(100vh-80px)] bg-slate-950 text-white overflow-hidden relative">
      <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageSelect} className="hidden" />
      <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={handleImageSelect} className="hidden" />

      {/* STATUS BAR */}
      <div className="absolute top-0 left-0 right-0 bg-slate-900/95 z-50 p-2 text-center text-xs font-mono border-b border-slate-700">
         <span className={voiceStatus.includes('Err') ? 'text-red-500 font-bold' : 'text-green-400 font-bold'}>
            STATUS: {voiceStatus}
         </span>
      </div>

      {/* MOBILE MENU */}
      {isSidebarOpen && (
        <div className="absolute inset-0 z-50 bg-slate-900/95 p-4 flex flex-col md:hidden pt-12">
            <button onClick={() => setIsSidebarOpen(false)} className="absolute top-4 right-4 p-2 bg-slate-800 rounded-full text-white"><X size={24}/></button>
            <div className="flex-1 overflow-y-auto space-y-3 mt-10">
                {models.map(m => (
                    <button key={m.id} onClick={() => { setSelectedModel(m); setIsSidebarOpen(false); }} className={`w-full text-left p-4 rounded-xl border ${selectedModel?.id === m.id ? 'bg-indigo-600 border-indigo-400' : 'bg-slate-800 border-transparent'}`}>
                        <div className="font-bold text-lg">{m.name}</div>
                    </button>
                ))}
            </div>
        </div>
      )}

      {/* DESKTOP SIDEBAR */}
      <div className="w-72 bg-slate-900 border-r border-slate-800 p-4 hidden md:flex flex-col mt-8">
        <h2 className="text-xs font-bold text-slate-400 mb-4 uppercase">Library</h2>
        <div className="flex-1 overflow-y-auto space-y-2">
          {models.map(m => (
            <button key={m.id} onClick={() => setSelectedModel(m)} className={`w-full text-left p-3 rounded-lg border ${selectedModel?.id === m.id ? 'bg-indigo-900/50 border-indigo-500' : 'border-transparent hover:bg-slate-800'}`}>
              <div className="font-medium truncate">{m.name}</div>
            </button>
          ))}
        </div>
      </div>

      {/* MAIN CHAT AREA */}
      <div className="flex-1 flex flex-col relative w-full mt-8">
        <div className="h-16 border-b border-slate-800 flex items-center justify-between px-4 bg-slate-900">
          <div className="flex items-center gap-3">
             <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 text-slate-400 hover:text-white bg-slate-800 rounded-lg"><Menu size={24}/></button>
            <div className={`w-3 h-3 rounded-full ${isTalking ? 'bg-green-400 animate-pulse' : (selectedModel ? 'bg-green-500' : 'bg-red-500')}`} />
            <h3 className="font-bold">{selectedModel ? selectedModel.name : 'Select Model'}</h3>
          </div>
          <button onClick={toggleCall} className={`flex gap-2 px-4 py-2 rounded-lg font-bold text-sm ${isTalking ? 'bg-red-500 text-white' : 'bg-green-600 text-white'}`}>
             {isTalking ? <PhoneOff size={18}/> : <Phone size={18}/>}
             {isTalking ? 'End Call' : 'Call Agent'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-3 md:p-4 rounded-2xl text-sm md:text-base ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-200'}`}>
                {msg.content}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-3 md:p-4 bg-slate-900 border-t border-slate-800 relative z-10">
          {attachedImage && (
             <div className="absolute -top-20 left-4 bg-slate-800 p-2 rounded-lg border flex gap-2"><img src={attachedImage} className="h-16 w-16 object-cover rounded" /><button onClick={removeImage} className="bg-red-500 rounded-full p-1 h-6 w-6 text-white"><X size={12}/></button></div>
          )}
          <form onSubmit={handleSend} className="max-w-4xl mx-auto flex gap-2 items-center">
            <button type="button" onClick={() => fileInputRef.current.click()} className="p-3 bg-slate-800 rounded-xl text-slate-400"><ImageIcon size={20}/></button>
            <button type="button" onClick={() => cameraInputRef.current.click()} className="p-3 bg-slate-800 rounded-xl text-slate-400"><Camera size={20}/></button>
            <input value={input} onChange={e => setInput(e.target.value)} disabled={loading || isTalking} className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white" placeholder="Type message..." />
            <button type="submit" disabled={!input.trim() && !attachedImage} className="bg-indigo-600 p-3 rounded-xl text-white"><Send size={20}/></button>
          </form>
        </div>
      </div>
    </div>
  )
}



import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { 
  Phone, PhoneOff, Star, TrendingUp, Search, Loader2, X, Server, AlertTriangle 
} from 'lucide-react'

// ⚠️ KEYS (ZIKO NDANI TAYARI)
const VAPI_PUBLIC_KEY = '150fa8ac-12a5-48fb-934f-0a9bbadc2da7'
const VAPI_ASSISTANT_ID = 'Be1bcb56-7536-493b-bca9-3261cf8e11b6'

export default function Marketplace() {
  const [models, setModels] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState(null)
  
  // Voice Call State
  const [activeCall, setActiveCall] = useState(null)
  const [voiceStatus, setVoiceStatus] = useState('Ready')
  const vapiRef = useRef(null)

  // ------------------ 1. INITIALIZE VAPI (Direct Line) ------------------
  useEffect(() => {
    let vapiInstance = null;
    
    const initVapi = async () => {
      try {
        const module = await import("https://esm.sh/@vapi-ai/web")
        const VapiClass = module.default || module.Vapi
        vapiInstance = new VapiClass(VAPI_PUBLIC_KEY)
        vapiRef.current = vapiInstance

        // Listeners
        vapiInstance.on('call-start', () => setVoiceStatus('Connected'))
        vapiInstance.on('call-end', () => {
             setActiveCall(null)
             setVoiceStatus('Ready')
        })
        vapiInstance.on('error', (e) => {
            console.error(e)
            setVoiceStatus('Error')
            setActiveCall(null)
            alert("Call Error: Check Console")
        })
      } catch (err) {
        console.error("Vapi Init Error", err)
      }
    }
    initVapi()

    return () => {
      if (vapiRef.current) vapiRef.current.stop()
    }
  }, [])

  // ------------------ 2. FETCH MODELS (From Supabase) ------------------
  useEffect(() => {
    fetchModels()
  }, [])

  async function fetchModels() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('ai_models')
        .select('*')
      
      if (error) {
        console.error("Supabase Error:", error)
        setErrorMsg("Error: " + error.message)
      } else {
        if (data.length === 0) {
          setErrorMsg("No agents found in database.")
        } else {
          setModels(data)
          setErrorMsg(null)
        }
      }
    } catch (err) {
      setErrorMsg("Critical Error: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  // ------------------ 3. HANDLE CALL (No 400 Error) ------------------
  const handleCall = async (model) => {
    if (!vapiRef.current) return

    // End call if clicking the same agent
    if (activeCall?.id === model.id) {
        vapiRef.current.stop()
        setActiveCall(null)
        return
    }

    // Start new call
    setActiveCall(model)
    setVoiceStatus('Connecting...')

    try {
        const { data: { user } } = await supabase.auth.getUser()
        
        // ⚠️ DIRECT CONNECTION: No serverUrl passed here
        await vapiRef.current.start(VAPI_ASSISTANT_ID, {
            variableValues: {
                userId: user?.id,
                modelId: model.id
            }
        })
    } catch (err) {
        console.error("Call Failed", err)
        setVoiceStatus('Call Failed')
        setActiveCall(null)
    }
  }

  // ------------------ 4. RENDER UI (US/EU Market Style) ------------------
  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8 pb-32 font-sans">
      
      {/* Header & Search */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent tracking-tight">
                AI Agent Marketplace
            </h1>
            <p className="text-slate-400 mt-2 text-lg">Discover & Talk to Top Experts Instantly</p>
        </div>
        <div className="relative w-full md:w-80 group">
            <Search className="absolute left-4 top-3.5 text-slate-500 group-focus-within:text-indigo-400 transition" size={20} />
            <input 
                placeholder="Search agents..." 
                className="w-full bg-slate-900 border border-slate-800 rounded-full pl-12 pr-6 py-3 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition shadow-lg" 
            />
        </div>
      </div>

      {errorMsg && (
        <div className="max-w-7xl mx-auto mb-8 p-4 bg-red-500/10 border border-red-500 rounded-xl text-red-200 flex items-center gap-3">
          <AlertTriangle size={20} />
          <span className="font-mono text-sm">{errorMsg}</span>
        </div>
      )}

      {/* FEATURED / TRENDING SECTION */}
      {!loading && models.length > 0 && (
        <div className="max-w-7xl mx-auto mb-16">
            <h2 className="flex items-center gap-2 text-xl font-bold mb-6 text-amber-400 uppercase tracking-wider">
                <TrendingUp size={24} /> Trending Now
            </h2>
            <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 border border-indigo-500/30 rounded-3xl p-6 md:p-10 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
                {/* Background Glow */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/20 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                <div className="w-28 h-28 md:w-32 md:h-32 rounded-2xl bg-indigo-600 flex items-center justify-center text-5xl font-bold shadow-2xl shadow-indigo-500/30 shrink-0">
                    {models[0].name[0]}
                </div>
                <div className="flex-1 text-center md:text-left z-10">
                    <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                        <span className="bg-amber-500/20 text-amber-300 text-xs font-bold px-2 py-1 rounded-full border border-amber-500/30">#1 TOP RATED</span>
                    </div>
                    <h3 className="text-3xl md:text-4xl font-bold mb-2">{models[0].name}</h3>
                    <p className="text-indigo-200 text-lg mb-4 max-w-2xl">{models[0].description}</p>
                    <div className="flex items-center justify-center md:justify-start gap-1 text-amber-400">
                        {[1,2,3,4,5].map(i => <Star key={i} fill="currentColor" size={20} className="drop-shadow-md"/>)}
                        <span className="text-slate-300 ml-2 font-mono text-sm">(5.0 • 12k+ Calls)</span>
                    </div>
                </div>
                <button 
                    onClick={() => handleCall(models[0])}
                    className={`px-10 py-4 rounded-full font-bold text-lg shadow-xl transition-all flex items-center gap-3 transform hover:scale-105 z-10 ${
                        activeCall?.id === models[0].id 
                        ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/40' 
                        : 'bg-white text-indigo-950 hover:bg-indigo-50 shadow-indigo-500/20'
                    }`}
                >
                    {activeCall?.id === models[0].id ? <PhoneOff /> : <Phone fill="currentColor" />}
                    {activeCall?.id === models[0].id ? 'End Call' : 'Call Agent'}
                </button>
            </div>
        </div>
      )}

      {/* AGENTS GRID */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <Loader2 className="animate-spin mb-4 text-indigo-500" size={48}/>
            <p>Loading global agents...</p>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {models.map((model) => (
                <div key={model.id} className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-2xl p-6 hover:border-indigo-500/50 transition-all duration-300 group hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-500/10">
                    <div className="flex justify-between items-start mb-5">
                        <div className="w-14 h-14 rounded-xl bg-slate-800 flex items-center justify-center text-2xl font-bold text-slate-300 group-hover:bg-indigo-600 group-hover:text-white transition-colors shadow-inner">
                            {model.name[0]}
                        </div>
                        <div className="bg-slate-800 border border-slate-700 text-xs px-3 py-1.5 rounded-full text-slate-400 font-mono">
                            ${model.input_price_1k}/1k
                        </div>
                    </div>
                    
                    <h3 className="font-bold text-xl mb-2 group-hover:text-indigo-400 transition-colors">{model.name}</h3>
                    <p className="text-sm text-slate-400 mb-6 line-clamp-2 leading-relaxed">
                        {model.description}
                    </p>
                    
                    <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                           <Server size={14}/> <span>{model.provider}</span>
                        </div>
                        <button 
                            onClick={() => handleCall(model)}
                            className={`px-5 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${
                                activeCall?.id === model.id 
                                ? 'bg-red-500/10 text-red-400 border border-red-500/50' 
                                : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/20'
                            }`}
                        >
                            {activeCall?.id === model.id ? 'Hang Up' : 'Call Now'}
                        </button>
                    </div>
                </div>
            ))}
        </div>
      )}

      {/* ACTIVE CALL OVERLAY (Sticky Bottom) */}
      {activeCall && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] md:w-auto bg-slate-900/90 backdrop-blur-xl border border-indigo-500/50 rounded-full pl-6 pr-2 py-2 flex items-center gap-4 md:gap-8 shadow-2xl shadow-indigo-500/20 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">
            <div className="flex items-center gap-4">
                <div className="relative">
                    <div className="w-3 h-3 bg-green-500 rounded-full relative z-10 animate-pulse"/>
                    <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-75"/>
                </div>
                <div className="flex flex-col">
                    <span className="font-bold text-white text-sm md:text-base">Talking to {activeCall.name}</span>
                    <span className="text-xs text-indigo-300 font-mono">{voiceStatus}</span>
                </div>
            </div>
            
            <button 
                onClick={() => handleCall(activeCall)}
                className="bg-red-500 hover:bg-red-600 text-white p-3 rounded-full transition-transform hover:scale-110 shadow-lg"
            >
                <PhoneOff size={20}/>
            </button>
        </div>
      )}
    </div>
  )
}
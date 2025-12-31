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
  
  // 🔥 FIX A: Using Ref to track selected Model inside Event Listeners
  const selectedModelRef = useRef(null)

  // ==================================================================================
  // ⚠️ CONFIGURATION (HARDCODED)
  const VAPI_PUBLIC_KEY = '150fa8ac-12a5-48fb-934f-0a9bbadc2da7'
  const VAPI_ASSISTANT_ID = 'Be1bcb56-7536-493b-bca9-3261cf8e11b6'
  const MY_SUPABASE_URL = 'https://hveyemdkojlijcesvtkt.supabase.co' 
  // ==================================================================================

  // 🔥 Sync Ref with State (Ensures listener gets the correct model)
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

        // Event Listeners
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

        // 🔥 FIX A: Transcripts now save to Supabase!
        vapi.on('message', async (msg) => {
          if (msg.type === 'transcript' && msg.transcriptType === 'final') {
            const text = msg.transcript
            
            // 1. Update UI (Chatbox)
            setMessages(p => [...p, { role: 'user', content: text }])

            // 2. Save to DB (Background)
            try {
                const { data: { user } } = await supabase.auth.getUser()
                const currentModel = selectedModelRef.current // Using Ref here!
                
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
          console.error('Vapi Error Event:', e)
          const errorMessage = e.error?.message || e.message || JSON.stringify(e)
          setIsTalking(false)
          setVoiceStatus(`Err: ${errorMessage}`)
        })

        setVoiceStatus('Ready')
      } catch (err) {
        console.error("Initialization Error:", err)
        setVoiceStatus(`Sys Err: ${err.message}`)
      }
    }

    initializeVapi()

    // 🔥 FIX C: Cleanup Memory Leak
    return () => {
      if (vapiRef.current) {
        vapiRef.current.stop()
        vapiRef.current.removeAllListeners() // Remove all listeners
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

      const { data } = await supabase
        .from('user_models')
        .select('ai_models (*)')
        .eq('user_id', user.id)

      if (data) {
        const list = data.map(i => i.ai_models).filter(Boolean)
        setModels(list)
        if (!selectedModel && list.length) setSelectedModel(list[0])
      }
    } catch (e) {
      console.error(e)
    }
  }

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
    } catch (e) {
      console.error(e)
    }
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

  // ------------------ CALL LOGIC ------------------
  const toggleCall = async () => {
    if (!vapiRef.current) return

    // 🔥 FIX B: Prevent Call if no Model is selected
    if (!selectedModel && !isTalking) {
        alert("Please select an AI Agent from the library first!")
        return
    }

    if (isTalking) {
      vapiRef.current.stop()
    } else {
      try {
        setVoiceStatus('Connecting...')
        
        const cleanUrl = MY_SUPABASE_URL.replace(/\/$/, '')
        const functionUrl = `${cleanUrl}/functions/v1/chat-engine`
        
        const { data: { user } } = await supabase.auth.getUser()

        await vapiRef.current.start(VAPI_ASSISTANT_ID, {
            serverUrl: functionUrl,
            variableValues: {
                userId: user?.id,
                modelId: selectedModel?.id
            }
        })

      } catch (err) {
        console.error('Start Error:', err)
        const safeMsg = err.message || JSON.stringify(err)
        setVoiceStatus(`Start Err: ${safeMsg}`)
      }
    }
  }

  // ------------------ CHAT LOGIC ------------------
  async function handleSend(e) {
    e.preventDefault()
    if ((!input.trim() && !attachedImage) || !selectedModel) return

    const text = input
    const image = attachedImage

    setInput('')
    setAttachedImage(null)
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()

    const userMsg = { role: 'user', content: text, image }
    setMessages(p => [...p, userMsg])

    if (user) {
      await supabase.from('chat_history').insert({
        user_id: user.id,
        role: 'user',
        content: text + (image ? ' [Image Sent]' : ''),
        model_id: selectedModel.id
      })
    }

    try {
      const { data, error } = await supabase.functions.invoke('chat-engine', {
        body: { message: text, model_id: selectedModel.id }
      })
      if (error) throw error

      const reply = data.reply

      if (user) {
        await supabase.from('chat_history').insert({
          user_id: user.id,
          role: 'ai',
          content: reply,
          model_id: selectedModel.id
        })
      }

      setMessages(p => [...p, { role: 'ai', content: reply }])
    } catch (err) {
      console.error(err)
      setMessages(p => [...p, { role: 'system', content: 'Connection Error' }])
    } finally {
      setLoading(false)
    }
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
         <span className={voiceStatus.includes('Err') || voiceStatus.includes('Error') ? 'text-red-500 font-bold' : 'text-green-400 font-bold'}>
            STATUS: {voiceStatus}
         </span>
      </div>

      {/* MOBILE MENU */}
      {isSidebarOpen && (
        <div className="absolute inset-0 z-50 bg-slate-900/95 p-4 flex flex-col md:hidden pt-12">
            <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
                <h2 className="font-bold text-lg text-indigo-400">Select Agent</h2>
                <button onClick={() => setIsSidebarOpen(false)} className="p-2 bg-slate-800 rounded-full text-white">
                    <X size={24}/>
                </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3">
                {models.map(m => (
                    <button 
                        key={m.id} 
                        onClick={() => { setSelectedModel(m); setIsSidebarOpen(false); }} 
                        className={`w-full text-left p-4 rounded-xl border ${selectedModel?.id === m.id ? 'bg-indigo-600 border-indigo-400 shadow-lg' : 'bg-slate-800 border-transparent'}`}
                    >
                        <div className="font-bold text-lg">{m.name}</div>
                        <div className="text-sm opacity-70">{m.provider}</div>
                    </button>
                ))}
            </div>
            <Link to="/marketplace" className="mt-4 p-4 bg-slate-800 rounded-xl text-center text-indigo-400 font-bold border border-slate-700">
                + Browse Marketplace
            </Link>
        </div>
      )}

      {/* DESKTOP SIDEBAR */}
      <div className="w-72 bg-slate-900 border-r border-slate-800 p-4 hidden md:flex flex-col mt-8">
        <h2 className="text-xs font-bold text-slate-400 mb-4 uppercase flex justify-between">
          My Library <Link to="/marketplace" className="text-indigo-400">+ Add</Link>
        </h2>
        <div className="flex-1 overflow-y-auto space-y-2">
          {models.map(m => (
            <button
              key={m.id}
              onClick={() => setSelectedModel(m)}
              className={`w-full text-left p-3 rounded-lg border ${
                selectedModel?.id === m.id
                  ? 'bg-indigo-900/50 border-indigo-500'
                  : 'border-transparent hover:bg-slate-800'
              }`}
            >
              <div className="font-medium truncate">{m.name}</div>
              <div className="text-xs text-slate-500">{m.provider}</div>
            </button>
          ))}
        </div>
      </div>

      {/* MAIN CHAT AREA */}
      <div className="flex-1 flex flex-col relative w-full mt-8">
        {/* Header */}
        <div className="h-16 border-b border-slate-800 flex items-center justify-between px-4 md:px-6 bg-slate-900/80 backdrop-blur">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 text-slate-400 hover:text-white bg-slate-800 rounded-lg">
                <Menu size={24}/>
            </button>

            <div className={`w-3 h-3 rounded-full ${
              isTalking ? 'bg-green-400 animate-pulse' :
              selectedModel ? 'bg-green-500' : 'bg-red-500'
            }`} />
            <div className="overflow-hidden">
              <h3 className="font-bold truncate max-w-[150px] md:max-w-none text-sm md:text-base">
                  {selectedModel ? selectedModel.name : 'Select Model'}
              </h3>
            </div>
          </div>
          <div className="flex gap-2 md:gap-3">
            <button
              onClick={toggleCall}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition shadow-lg ${
                isTalking ? 'bg-red-500/20 text-red-500 border border-red-500/50' : 'bg-green-600 text-white hover:bg-green-500'
              }`}
            >
              {isTalking ? <PhoneOff size={18} /> : <Phone size={18} />}
              <span className="hidden md:inline">
                {isTalking ? 'End Call' : 'Call Agent'}
              </span>
            </button>
            <button onClick={clearChat} className="p-2 hover:bg-slate-800 rounded text-slate-400">
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role !== 'user' && (
                <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center shrink-0">
                  <Bot size={16} />
                </div>
              )}
              <div className={`max-w-[85%] p-3 md:p-4 rounded-2xl text-sm md:text-base ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-none'
                  : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none'
              }`}>
                {msg.image && (
                  <img src={msg.image} alt="Upload" className="max-w-full rounded-lg mb-2 border border-white/20" />
                )}
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center shrink-0">
                  <User size={16} />
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-3 md:p-4 bg-slate-900 border-t border-slate-800 relative z-10">
          {attachedImage && (
            <div className="absolute -top-20 left-4 bg-slate-800 p-2 rounded-lg border border-slate-700 shadow-xl flex gap-2">
              <img src={attachedImage} alt="Preview" className="h-16 w-16 object-cover rounded" />
              <button
                onClick={removeImage}
                className="bg-red-500 rounded-full p-1 h-6 w-6 flex items-center justify-center text-white"
              >
                <X size={12} />
              </button>
            </div>
          )}
          <form onSubmit={handleSend} className="max-w-4xl mx-auto flex gap-2 items-center">
            <button
              type="button"
              onClick={() => fileInputRef.current.click()}
              className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-indigo-400 transition"
            >
              <ImageIcon size={20} />
            </button>
            <button
              type="button"
              onClick={() => cameraInputRef.current.click()}
              className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-indigo-400 transition"
            >
              <Camera size={20} />
            </button>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={loading || isTalking}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none placeholder:text-slate-600"
              placeholder={isTalking ? 'Voice Active...' : 'Type message...'}
            />
            <button
              type="submit"
              disabled={(!input.trim() && !attachedImage) || loading}
              className="bg-indigo-600 hover:bg-indigo-700 px-4 py-3 rounded-xl text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={20} />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
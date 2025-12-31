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

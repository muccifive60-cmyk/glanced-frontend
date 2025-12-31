import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import Vapi from '@vapi-ai/web' // <--- HII IMPORT MPYA NDIO DAWA
import {
  Send, Bot, User, Trash2, Phone, PhoneOff, Camera, Image as ImageIcon, X, Menu
} from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Playground() {
  // ------------------ STATE ------------------
  const [models, setModels] = useState([])
  const [selectedModel, setSelectedModel] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  // Image
  const [attachedImage, setAttachedImage] = useState(null)
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)

  // Voice
  const [isTalking, setIsTalking] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState('Initializing...') // Status ya Sauti
  
  const messagesEndRef = useRef(null)
  const vapiRef = useRef(null)

  // KEYS
  const VAPI_PUBLIC_KEY = '150fa8ac-12a5-48fb-934f-0a9bbadc2da7'
  const VAPI_ASSISTANT_ID = 'be1bcb56-7536-493b-bd99-52e041d8e950'

  // ------------------ INIT ------------------
  useEffect(() => {
    fetchLibraryModels()
    fetchChatHistory()
    
    // HAPA: Tunawasha Vapi moja kwa moja bila script ya nje
    try {
        const vapi = new Vapi(VAPI_PUBLIC_KEY)
        vapiRef.current = vapi

        vapi.on('call-start', () => { setIsTalking(true); setVoiceStatus('Connected'); })
        vapi.on('call-end', () => { setIsTalking(false); setVoiceStatus('Ready'); })
        vapi.on('speech-start', () => { setVoiceStatus('Listening...'); })
        
        vapi.on('message', (msg) => {
            if (msg.type === 'transcript' && msg.transcriptType === 'final') {
                setMessages(p => [...p, { role: 'user', content: msg.transcript }])
            }
        })
        
        vapi.on('error', (e) => { 
            console.error('Vapi Error:', e); 
            setIsTalking(false); 
            setVoiceStatus('Engine Error'); 
        })

        setVoiceStatus('Ready') // Tayari kutumika
    } catch (err) {
        console.error("Vapi Init Error:", err)
        setVoiceStatus("System Error")
    }

    return () => { if (vapiRef.current) vapiRef.current.stop() }
  }, [])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // ------------------ DATA ------------------
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

  // ------------------ CALL (SUPABASE PRO MODE) ------------------
  const toggleCall = async () => {
    if (!vapiRef.current) return

    if (isTalking) {
      vapiRef.current.stop()
    } else {
      try {
        setVoiceStatus('Connecting...')
        
        const rawUrl = import.meta.env.VITE_SUPABASE_URL
        const cleanUrl = rawUrl ? rawUrl.replace(/\/$/, '') : null
        const functionUrl = cleanUrl ? `${cleanUrl}/functions/v1/chat-engine` : null
        
        if (!functionUrl) {
             console.error("Missing Backend URL")
             setVoiceStatus("Config Error")
             return
        }

        const { data: { user } } = await supabase.auth.getUser()

        await vapiRef.current.start(VAPI_ASSISTANT_ID, {
            serverUrl: functionUrl,
            variableValues: {
                userId: user?.id,
                modelId: selectedModel?.id
            }
        })
      } catch (err) {
        console.error('Vapi start error:', err)
        setIsTalking(false)
        setVoiceStatus('Engine Error')
      }
    }
  }

  // ------------------ CHAT ------------------
  async function handleSend(e) {
    e.preventDefault()
    if ((!input.trim() && !attachedImage) || !selectedModel) return
    const text = input; const image = attachedImage
    setInput(''); setAttachedImage(null); setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    const userMsg = { role: 'user', content: text, image }
    setMessages(p => [...p, userMsg])
    if (user) await supabase.from('chat_history').insert({ user_id: user.id, role: 'user', content: text + (image ? ' [Image]' : ''), model_id: selectedModel.id })

    try {
      const { data, error } = await supabase.functions.invoke('chat-engine', { body: { message: text, model_id: selectedModel.id } })
      if (error) throw error
      if (user) await supabase.from('chat_history').insert({ user_id: user.id, role: 'ai', content: data.reply, model_id: selectedModel.id })
      setMessages(p => [...p, { role: 'ai', content: data.reply }])
    } catch (err) { setMessages(p => [...p, { role: 'system', content: 'Connection Error' }]) } 
    finally { setLoading(false) }
  }

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader(); reader.onloadend = () => setAttachedImage(reader.result); reader.readAsDataURL(file)
  }

  // ------------------ UI ------------------
  return (
    <div className="flex h-[calc(100vh-80px)] bg-slate-950 text-white overflow-hidden relative">
      <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageSelect} className="hidden" />
      <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={handleImageSelect} className="hidden" />

      {/* MOBILE MENU */}
      {isSidebarOpen && (
        <div className="absolute inset-0 z-50 bg-slate-900/95 p-4 flex flex-col md:hidden">
            <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
                <h2 className="font-bold text-lg text-indigo-400">Select Agent</h2>
                <button onClick={() => setIsSidebarOpen(false)} className="p-2 bg-slate-800 rounded-full text-white"><X size={24}/></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3">
                {models.map(m => (
                    <button key={m.id} onClick={() => { setSelectedModel(m); setIsSidebarOpen(false); }} className={`w-full text-left p-4 rounded-xl border ${selectedModel?.id === m.id ? 'bg-indigo-600 border-indigo-400' : 'bg-slate-800 border-transparent'}`}>
                        <div className="font-bold text-lg">{m.name}</div>
                        <div className="text-sm opacity-70">{m.provider}</div>
                    </button>
                ))}
            </div>
            <Link to="/marketplace" className="mt-4 p-4 bg-slate-800 rounded-xl text-center text-indigo-400 font-bold border border-slate-700">+ Browse Marketplace</Link>
        </div>
      )}

      {/* DESKTOP SIDEBAR */}
      <div className="w-72 bg-slate-900 border-r border-slate-800 p-4 hidden md:flex flex-col">
        <h2 className="text-xs font-bold text-slate-400 mb-4 uppercase flex justify-between">Library <Link to="/marketplace" className="text-indigo-400">+ Add</Link></h2>
        <div className="flex-1 overflow-y-auto space-y-2">
          {models.map(m => (
            <button key={m.id} onClick={() => setSelectedModel(m)} className={`w-full text-left p-3 rounded-lg border ${selectedModel?.id === m.id ? 'bg-indigo-900/50 border-indigo-500' : 'border-transparent hover:bg-slate-800'}`}>
              <div className="font-medium truncate">{m.name}</div>
              <div className="text-xs text-slate-500">{m.provider}</div>
            </button>
          ))}
        </div>
      </div>

      {/* CHAT AREA */}
      <div className="flex-1 flex flex-col relative w-full">
        <div className="h-16 border-b border-slate-800 flex items-center justify-between px-4 md:px-6 bg-slate-900/80 backdrop-blur">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 text-slate-400 hover:text-white bg-slate-800 rounded-lg"><Menu size={24}/></button>
            <div className={`w-3 h-3 rounded-full ${isTalking ? 'bg-green-400 animate-pulse' : (selectedModel ? 'bg-green-500' : 'bg-red-500')}`} />
            <div className="overflow-hidden">
              <h3 className="font-bold truncate max-w-[150px] md:max-w-none text-sm md:text-base">{selectedModel ? selectedModel.name : 'Select Model'}</h3>
              <p className="text-[10px] md:text-xs text-slate-400">{voiceStatus}</p>
            </div>
          </div>
          <div className="flex gap-2 md:gap-3">
            <button onClick={toggleCall} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition shadow-lg ${isTalking ? 'bg-red-500/20 text-red-500 border border-red-500/50' : 'bg-green-600 text-white hover:bg-green-500'}`}>
              {isTalking ? <PhoneOff size={18}/> : <Phone size={18}/>}
              <span className="hidden md:inline">{isTalking ? 'End Call' : 'Call Agent'}</span>
            </button>
            <button onClick={() => setMessages([])} className="p-2 hover:bg-slate-800 rounded text-slate-400"><Trash2 size={18}/></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role !== 'user' && <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center shrink-0"><Bot size={16}/></div>}
              <div className={`max-w-[85%] p-3 md:p-4 rounded-2xl text-sm md:text-base ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none'}`}>
                {msg.image && <img src={msg.image} alt="Sent" className="max-w-full rounded-lg mb-2 border border-white/20" />}
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-3 md:p-4 bg-slate-900 border-t border-slate-800 relative z-10">
          {attachedImage && (
             <div className="absolute -top-20 left-4 bg-slate-800 p-2 rounded-lg border border-slate-700 shadow-xl flex gap-2"><img src={attachedImage} className="h-16 w-16 object-cover rounded" /><button onClick={() => setAttachedImage(null)} className="bg-red-500 rounded-full p-1 h-6 w-6 flex items-center justify-center text-white"><X size={12}/></button></div>
          )}
          <form onSubmit={handleSend} className="max-w-4xl mx-auto flex gap-2 items-center">
            <button type="button" onClick={() => fileInputRef.current.click()} className="p-3 bg-slate-800 rounded-xl text-slate-400"><ImageIcon size={20}/></button>
            <button type="button" onClick={() => cameraInputRef.current.click()} className="p-3 bg-slate-800 rounded-xl text-slate-400"><Camera size={20}/></button>
            <input value={input} onChange={e => setInput(e.target.value)} disabled={loading || isTalking} className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none placeholder:text-slate-600" placeholder={isTalking ? 'Voice Active...' : 'Type message...'} />
            <button type="submit" disabled={!input.trim() && !attachedImage} className="bg-indigo-600 p-3 rounded-xl text-white"><Send size={20}/></button>
          </form>
        </div>
      </div>
    </div>
  )
}
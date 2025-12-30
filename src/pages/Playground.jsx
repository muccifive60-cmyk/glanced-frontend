import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { Send, Bot, User, Trash2, Phone, PhoneOff, Camera, Image as ImageIcon, X } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Playground() {
  // --- STATE MANAGEMENT ---
  const [models, setModels] = useState([])
  const [selectedModel, setSelectedModel] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  // --- IMAGE STATE ---
  const [attachedImage, setAttachedImage] = useState(null)
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)

  // --- VOICE STATE ---
  const [isTalking, setIsTalking] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState('Initializing...')
  const [vapiReady, setVapiReady] = useState(false)

  const messagesEndRef = useRef(null)
  const vapiRef = useRef(null)

  // --- KEYS ---
  const VAPI_PUBLIC_KEY = "150fa8ac-12a5-48fb-934f-0a9bbadc2da7"
  const VAPI_ASSISTANT_ID = "be1bcb56-7536-493b-bd99-52e041d8e950"

  // --- INIT ---
  useEffect(() => {
    fetchLibraryModels()
    fetchChatHistory()
    loadVapiScript()

    return () => {
      if (vapiRef.current) vapiRef.current.stop()
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // --- VAPI ENGINE (FIXED) ---
  function loadVapiScript() {
    if (window.Vapi) {
      initializeVapiInstance()
      return
    }

    setVoiceStatus("Downloading Engine...")

    const script = document.createElement("script")
    script.src = "https://cdn.jsdelivr.net/npm/@vapi-ai/web@latest/dist/vapi.min.js"
    script.async = true

    script.onload = () => initializeVapiInstance()
    script.onerror = () => setVoiceStatus("Network Error")

    document.body.appendChild(script)
  }

  function initializeVapiInstance() {
    try {
      const VapiClass = window.Vapi?.default || window.Vapi
      if (!VapiClass) throw new Error("Vapi constructor not found")

      const vapiInstance = new VapiClass(VAPI_PUBLIC_KEY)
      vapiRef.current = vapiInstance

      vapiInstance.on('call-start', () => {
        setIsTalking(true)
        setVoiceStatus('Connected')
      })

      vapiInstance.on('call-end', () => {
        setIsTalking(false)
        setVoiceStatus('Ready')
      })

      vapiInstance.on('error', (e) => {
        console.error("Vapi Error:", e)
        setIsTalking(false)
        setVoiceStatus('Engine Error')
      })

      setVapiReady(true)
      setVoiceStatus('Ready')
    } catch (err) {
      console.error("VAPI INIT ERROR:", err)
      setVoiceStatus("Engine Error")
    }
  }

  // --- DATABASE ---
  async function fetchLibraryModels() {
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
  }

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

  // --- IMAGE ---
  const handleImageSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onloadend = () => setAttachedImage(reader.result)
    reader.readAsDataURL(file)
  }

  const removeImage = () => {
    setAttachedImage(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
    if (cameraInputRef.current) cameraInputRef.current.value = ""
  }

  // --- CALL ---
  const toggleCall = async () => {
    if (!vapiReady || !vapiRef.current) return

    if (isTalking) {
      vapiRef.current.stop()
    } else {
      setVoiceStatus('Connecting...')
      try {
        await vapiRef.current.start(VAPI_ASSISTANT_ID)
      } catch {
        setVoiceStatus("Call Failed")
      }
    }
  }

  // --- CHAT ---
  async function handleSend(e) {
    e.preventDefault()
    if ((!input.trim() && !attachedImage) || !selectedModel) return

    const text = input
    const image = attachedImage

    setInput('')
    setAttachedImage(null)
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()

    setMessages(p => [...p, { role: 'user', content: text, image }])

    try {
      const { data, error } = await supabase.functions.invoke('chat-engine', {
        body: { message: text, model_id: selectedModel.id }
      })
      if (error) throw error

      setMessages(p => [...p, { role: 'ai', content: data.reply }])
    } catch {
      setMessages(p => [...p, { role: 'system', content: "Error connecting to AI." }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-80px)] bg-slate-950 text-white overflow-hidden">
      {/* HIDDEN INPUTS */}
      <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageSelect} className="hidden" />
      <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={handleImageSelect} className="hidden" />

      {/* SIDEBAR */}
      <div className="w-72 bg-slate-900 border-r border-slate-800 p-4 hidden md:flex flex-col">
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

      {/* CHAT AREA */}
      <div className="flex-1 flex flex-col relative">
        <div className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/80 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${
              isTalking ? 'bg-green-400 animate-pulse' :
              selectedModel ? 'bg-green-500' : 'bg-red-500'
            }`} />
            <div>
              <h3 className="font-bold">{selectedModel ? selectedModel.name : 'Select Model'}</h3>
              <p className="text-xs text-slate-400">{voiceStatus}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={toggleCall}
              className={`flex gap-2 px-4 py-2 rounded-lg font-medium ${
                isTalking
                  ? 'bg-red-500/20 text-red-500'
                  : 'bg-green-600 text-white'
              }`}
            >
              {isTalking ? <PhoneOff size={18}/> : <Phone size={18}/>}
              <span className="hidden sm:inline">
                {isTalking ? 'End Call' : 'Call Agent'}
              </span>
            </button>
            <button className="p-2 hover:bg-slate-800 rounded text-slate-400">
              <Trash2 size={18}/>
            </button>
          </div>
        </div>

        {/* MESSAGES */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role !== 'user' && (
                <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center">
                  <Bot size={16}/>
                </div>
              )}

              <div className={`max-w-[80%] p-4 rounded-2xl ${
                msg.role === 'user'
                  ? 'bg-indigo-600 rounded-br-none'
                  : 'bg-slate-800 border border-slate-700 rounded-bl-none'
              }`}>
                {msg.image && (
                  <img src={msg.image} className="max-w-full rounded-lg mb-2" />
                )}
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center">
                  <User size={16}/>
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* INPUT */}
        <div className="p-4 bg-slate-900 border-t border-slate-800">
          <form onSubmit={handleSend} className="flex gap-2 items-center">
            <button type="button" onClick={() => fileInputRef.current.click()} className="p-3 bg-slate-800 rounded-xl">
              <ImageIcon size={20}/>
            </button>
            <button type="button" onClick={() => cameraInputRef.current.click()} className="p-3 bg-slate-800 rounded-xl">
              <Camera size={20}/>
            </button>

            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={loading || isTalking}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3"
              placeholder={isTalking ? "Voice Active..." : "Type message..."}
            />

            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 px-4 py-3 rounded-xl"
            >
              <Send size={20}/>
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

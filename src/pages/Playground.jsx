import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import Vapi from '@vapi-ai/web'
import {
  Send, Bot, User, Trash2, Phone, PhoneOff, Camera, Image as ImageIcon, X, Menu, AlertCircle
} from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Playground() {
  // ------------------ DEBUG STATE ------------------
  const [logs, setLogs] = useState([])
  const addLog = (msg) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev])

  // ------------------ NORMAL STATE ------------------
  const [models, setModels] = useState([])
  const [selectedModel, setSelectedModel] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const [attachedImage, setAttachedImage] = useState(null)
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)

  const [isTalking, setIsTalking] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState('Initializing...')
  
  const messagesEndRef = useRef(null)
  const vapiRef = useRef(null)

  // KEYS
  const VAPI_PUBLIC_KEY = '150fa8ac-12a5-48fb-934f-0a9bbadc2da7'
  const VAPI_ASSISTANT_ID = 'be1bcb56-7536-493b-bd99-52e041d8e950'

  // ------------------ INIT ------------------
  useEffect(() => {
    addLog("App Mounted. Starting Init...")
    fetchLibraryModels()
    fetchChatHistory()
    
    try {
        addLog("Initializing Vapi SDK...")
        const vapi = new Vapi(VAPI_PUBLIC_KEY)
        vapiRef.current = vapi
        addLog("Vapi Instance Created.")

        vapi.on('call-start', () => { 
            addLog("Event: Call Started")
            setIsTalking(true)
            setVoiceStatus('Connected') 
        })
        vapi.on('call-end', () => { 
            addLog("Event: Call Ended")
            setIsTalking(false)
            setVoiceStatus('Ready') 
        })
        vapi.on('error', (e) => { 
            addLog(`Vapi Error Event: ${JSON.stringify(e)}`)
            console.error('Vapi Error:', e)
            setIsTalking(false)
            setVoiceStatus('Engine Error') 
        })

        setVoiceStatus('Ready')
        addLog("Vapi Setup Complete. Status: Ready")
    } catch (err) {
        addLog(`CRITICAL INIT ERROR: ${err.message}`)
        console.error("Vapi Init Error:", err)
        setVoiceStatus("System Error")
    }

    return () => { if (vapiRef.current) vapiRef.current.stop() }
  }, [])

  // ------------------ DATA ------------------
  async function fetchLibraryModels() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { addLog("No User Found"); return }
      const { data } = await supabase.from('user_models').select('ai_models (*)').eq('user_id', user.id)
      if (data) {
        const list = data.map(i => i.ai_models).filter(Boolean)
        setModels(list)
        if (!selectedModel && list.length) setSelectedModel(list[0])
      }
    } catch (e) { addLog(`Fetch Error: ${e.message}`) }
  }

  async function fetchChatHistory() { /* ... existing logic ... */ }

  // ------------------ CALL LOGIC (DEBUGGED) ------------------
  const toggleCall = async () => {
    addLog("Button Clicked: toggleCall")
    
    if (!vapiRef.current) {
        addLog("ERROR: vapiRef is null! Init failed.")
        return
    }

    if (isTalking) {
      addLog("Action: Stopping Call")
      vapiRef.current.stop()
    } else {
      try {
        setVoiceStatus('Connecting...')
        addLog("Action: Starting Call...")
        
        const rawUrl = import.meta.env.VITE_SUPABASE_URL
        addLog(`Supabase URL found: ${!!rawUrl}`) // True/False check
        
        const cleanUrl = rawUrl ? rawUrl.replace(/\/$/, '') : null
        const functionUrl = cleanUrl ? `${cleanUrl}/functions/v1/chat-engine` : null
        
        if (!functionUrl) {
             addLog("ERROR: Function URL is missing!")
             setVoiceStatus("Config Error")
             return
        }

        addLog(`Target URL: ...${functionUrl.slice(-20)}`) // Show last part of URL

        const { data: { user } } = await supabase.auth.getUser()
        addLog(`User ID: ${user?.id || 'None'}`)

        addLog("Calling vapi.start()...")
        await vapiRef.current.start(VAPI_ASSISTANT_ID, {
            serverUrl: functionUrl,
            variableValues: {
                userId: user?.id,
                modelId: selectedModel?.id
            }
        })
        addLog("vapi.start() executed.")
      } catch (err) {
        addLog(`START ERROR: ${err.message}`)
        console.error('Vapi start error:', err)
        setIsTalking(false)
        setVoiceStatus('Engine Error')
      }
    }
  }

  // ------------------ CHAT LOGIC ------------------
  async function handleSend(e) { /* ... existing logic ... */ }
  const handleImageSelect = (e) => { /* ... existing logic ... */ }

  return (
    <div className="flex h-[calc(100vh-80px)] bg-slate-950 text-white overflow-hidden relative">
      {/* ... hidden inputs ... */}
      
      {/* DEBUG BOX (Hii itatuonyesha tatizo) */}
      <div className="absolute top-0 left-0 right-0 bg-slate-900/90 z-40 p-2 text-[10px] font-mono border-b border-red-500 max-h-32 overflow-y-auto">
        <div className="flex justify-between text-red-400 font-bold sticky top-0 bg-slate-900/90">
            <span>🕵️ DETECTIVE MODE (Logs)</span>
            <button onClick={() => setLogs([])}>Clear</button>
        </div>
        {logs.map((log, i) => <div key={i} className="border-b border-slate-800 py-1">{log}</div>)}
      </div>

      {/* MOBILE MENU */}
      {isSidebarOpen && (
        <div className="absolute inset-0 z-50 bg-slate-900/95 p-4 flex flex-col md:hidden pt-36">
           {/* ... menu content ... */}
            <button onClick={() => setIsSidebarOpen(false)} className="absolute top-4 right-4 p-2"><X/></button>
             {/* ... */}
        </div>
      )}

      {/* DESKTOP SIDEBAR */}
      <div className="w-72 bg-slate-900 border-r border-slate-800 p-4 hidden md:flex flex-col">
         {/* ... sidebar content ... */}
         {models.map(m => (
            <button key={m.id} onClick={() => setSelectedModel(m)} className="p-2 text-left border border-slate-700 mb-2 rounded">
                {m.name}
            </button>
         ))}
      </div>

      {/* CHAT AREA */}
      <div className="flex-1 flex flex-col relative w-full pt-32 md:pt-0"> {/* Padding top for debug box */}
        <div className="h-16 border-b border-slate-800 flex items-center justify-between px-4 bg-slate-900">
           {/* ... header ... */}
           <div className="flex items-center gap-3">
              <button onClick={() => setIsSidebarOpen(true)} className="md:hidden"><Menu/></button>
              <div>
                  <div className="font-bold">{selectedModel?.name || 'GPT-4o'}</div>
                  <div className="text-xs text-slate-400">{voiceStatus}</div>
              </div>
           </div>

           <button onClick={toggleCall} className={`flex gap-2 px-4 py-2 rounded font-bold ${isTalking ? 'bg-red-600' : 'bg-green-600'}`}>
               {isTalking ? <PhoneOff/> : <Phone/>}
               {isTalking ? 'Stop' : 'Call Agent'}
           </button>
        </div>

        {/* MESSAGES */}
        <div className="flex-1 overflow-y-auto p-4">
           {/* ... messages ... */}
        </div>

        {/* INPUT */}
        <div className="p-4 bg-slate-900">
           {/* ... input form ... */}
        </div>
      </div>
    </div>
  )
}

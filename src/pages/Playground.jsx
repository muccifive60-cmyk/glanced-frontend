import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import * as VapiSDK from '@vapi-ai/web' // <--- SMART IMPORT (Tunachukua kila kitu)
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

  // ------------------ INIT (FIXED) ------------------
  useEffect(() => {
    addLog("App Mounted. Starting Init...")
    fetchLibraryModels()
    fetchChatHistory()
    
    try {
        addLog("Inspecting Vapi Package...")
        
        // SMART CONSTRUCTOR FINDER
        // Tunajaribu kutafuta Class ilipo: .Vapi (Named), .default (Default), au yenyewe (Module)
        const VapiClass = VapiSDK.Vapi || VapiSDK.default || VapiSDK
        
        addLog(`Constructor Found: ${!!VapiClass}`)
        
        const vapi = new VapiClass(VAPI_PUBLIC_KEY)
        vapiRef.current = vapi
        addLog("Vapi Instance Created Successfully ✅")

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
            addLog(`Vapi Error: ${JSON.stringify(e)}`)
            console.error('Vapi Error:', e)
            setIsTalking(false)
            setVoiceStatus('Engine Error') 
        })

        setVoiceStatus('Ready')
        addLog("System Ready. Waiting for user...")
    } catch (err) {
        addLog(`CRITICAL FIX FAILED: ${err.message}`)
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

  // ------------------ CALL LOGIC ------------------
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
        const cleanUrl = rawUrl ? rawUrl.replace(/\/$/, '') : null
        const functionUrl = cleanUrl ? `${cleanUrl}/functions/v1/chat-engine` : null
        
        if (!functionUrl) {
             addLog("ERROR: Function URL is missing!")
             setVoiceStatus("Config Error")
             return
        }

        const { data: { user } } = await supabase.auth.getUser()
        addLog(`Target: Supabase Edge Function`)

        await vapiRef.current.start(VAPI_ASSISTANT_ID, {
            serverUrl: functionUrl,
            variableValues: {
                userId: user?.id,
                modelId: selectedModel?.id
            }
        })
        addLog("Request Sent to Supabase.")
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
      {/* DEBUG BOX */}
      <div className="absolute top-0 left-0 right-0 bg-slate-900/90 z-40 p-2 text-[10px] font-mono border-b border-green-500 max-h-32 overflow-y-auto">
        <div className="flex justify-between text-green-400 font-bold sticky top-0 bg-slate-900/90">
            <span>🕵️ DETECTIVE MODE (Fixing...)</span>
            <button onClick={() => setLogs([])}>Clear</button>
        </div>
        {logs.map((log, i) => <div key={i} className="border-b border-slate-800 py-1">{log}</div>)}
      </div>

      {/* MOBILE MENU */}
      {isSidebarOpen && (
        <div className="absolute inset-0 z-50 bg-slate-900/95 p-4 flex flex-col md:hidden pt-36">
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
        </div>
      )}

      {/* DESKTOP SIDEBAR */}
      <div className="w-72 bg-slate-900 border-r border-slate-800 p-4 hidden md:flex flex-col">
         <h2 className="text-xs font-bold text-slate-400 mb-4 uppercase">My Library</h2>
         {models.map(m => (
            <button key={m.id} onClick={() => setSelectedModel(m)} className={`w-full text-left p-3 rounded-lg border mb-2 ${selectedModel?.id === m.id ? 'bg-indigo-900/50 border-indigo-500' : 'border-transparent hover:bg-slate-800'}`}>
                {m.name}
            </button>
         ))}
      </div>

      {/* CHAT AREA */}
      <div className="flex-1 flex flex-col relative w-full pt-32 md:pt-0">
        <div className="h-16 border-b border-slate-800 flex items-center justify-between px-4 bg-slate-900">
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
           {/* Placeholder for messages */}
           {messages.length === 0 && <div className="text-slate-500 text-center mt-10">Select a model to chat</div>}
           {messages.map((msg, i) => (
             <div key={i} className="mb-4 p-2 bg-slate-800 rounded">{msg.content}</div>
           ))}
        </div>

        {/* INPUT */}
        <div className="p-4 bg-slate-900">
           <input className="w-full bg-slate-800 p-3 rounded text-white" placeholder="Type message..." disabled />
        </div>
      </div>
    </div>
  )
}

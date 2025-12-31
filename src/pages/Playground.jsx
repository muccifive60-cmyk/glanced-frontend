import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import {
  Send, Bot, User, Trash2, Camera, Image as ImageIcon, X, Menu, MessageSquare
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
  
  const messagesEndRef = useRef(null)

  // ------------------ INITIALIZATION ------------------
  useEffect(() => {
    fetchLibraryModels()
    fetchChatHistory()
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

  // ------------------ CHAT LOGIC (TEXT ONLY) ------------------
  async function handleSend(e) {
    e.preventDefault()
    if ((!input.trim() && !attachedImage) || !selectedModel) return

    const text = input
    const image = attachedImage

    setInput('')
    setAttachedImage(null)
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()

    // 1. Onyesha meseji ya user haraka (Optimistic UI)
    const userMsg = { role: 'user', content: text, image }
    setMessages(p => [...p, userMsg])

    // 2. Save user message to DB
    if (user) {
      await supabase.from('chat_history').insert({
        user_id: user.id,
        role: 'user',
        content: text + (image ? ' [Image Sent]' : ''),
        model_id: selectedModel.id
      })
    }

    // 3. Tuma kwa Supabase Chat Engine (Text Logic)
    try {
      const { data, error } = await supabase.functions.invoke('chat-engine', {
        body: { message: text, model_id: selectedModel.id }
      })

      if (error) throw error

      const reply = data.reply || "No response received."

      // 4. Save AI reply to DB
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
      setMessages(p => [...p, { role: 'system', content: '⚠️ Connection Error: Failed to reach Chat Engine.' }])
    } finally {
      setLoading(false)
    }
  }

  async function clearChat() {
    if (!confirm('Delete chat history?')) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('chat_history').delete().eq('user_id', user.id)
    setMessages([])
  }

  // ------------------ UI RENDER ------------------
  return (
    <div className="flex h-[calc(100vh-80px)] bg-slate-950 text-white overflow-hidden relative font-sans">
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handleImageSelect}
        className="hidden"
      />
      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={cameraInputRef}
        onChange={handleImageSelect}
        className="hidden"
      />

      {/* MOBILE MENU */}
      {isSidebarOpen && (
        <div className="absolute inset-0 z-50 bg-slate-900/95 p-4 flex flex-col md:hidden pt-12 animate-in fade-in slide-in-from-left-10">
            <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
                <h2 className="font-bold text-lg text-indigo-400">Select Chat Model</h2>
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
                + Add More Models
            </Link>
        </div>
      )}

      {/* DESKTOP SIDEBAR */}
      <div className="w-72 bg-slate-900 border-r border-slate-800 p-4 hidden md:flex flex-col mt-8">
        <h2 className="text-xs font-bold text-slate-400 mb-4 uppercase flex justify-between">
          Chat Models <Link to="/marketplace" className="text-indigo-400 hover:text-indigo-300">+ Add</Link>
        </h2>
        <div className="flex-1 overflow-y-auto space-y-2">
          {models.map(m => (
            <button
              key={m.id}
              onClick={() => setSelectedModel(m)}
              className={`w-full text-left p-3 rounded-lg border transition-all ${
                selectedModel?.id === m.id
                  ? 'bg-indigo-900/50 border-indigo-500 shadow-md'
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

            <div className={`w-3 h-3 rounded-full ${selectedModel ? 'bg-green-500' : 'bg-slate-500'}`} />
            <div className="overflow-hidden">
              <h3 className="font-bold truncate max-w-[200px] md:max-w-none text-sm md:text-base">
                  {selectedModel ? selectedModel.name : 'Select a Model to Chat'}
              </h3>
            </div>
          </div>
          
          <div className="flex gap-2">
             <Link to="/marketplace" className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-sm text-slate-300 transition">
                Need Voice Call? Go to Marketplace
             </Link>
             <button onClick={clearChat} className="p-2 hover:bg-red-500/10 hover:text-red-400 rounded text-slate-400 transition" title="Clear Chat">
               <Trash2 size={18} />
             </button>
          </div>
        </div>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {messages.length === 0 && (
             <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-50">
                 <MessageSquare size={48} className="mb-4"/>
                 <p>Start a conversation...</p>
             </div>
          )}
          
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role !== 'user' && (
                <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20">
                  <Bot size={16} />
                </div>
              )}
              <div className={`max-w-[85%] p-3 md:p-4 rounded-2xl text-sm md:text-base shadow-sm ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-none'
                  : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none'
              }`}>
                {msg.image && (
                  <img src={msg.image} alt="Upload" className="max-w-full rounded-lg mb-3 border border-white/20" />
                )}
                <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center shrink-0">
                  <User size={16} />
                </div>
              )}
            </div>
          ))}
          {loading && (
             <div className="flex gap-3 justify-start">
                 <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center shrink-0"><Bot size={16}/></div>
                 <div className="bg-slate-800 p-4 rounded-2xl rounded-bl-none flex gap-1 items-center">
                     <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"/>
                     <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-100"/>
                     <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-200"/>
                 </div>
             </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-3 md:p-4 bg-slate-900 border-t border-slate-800 relative z-10">
          {attachedImage && (
            <div className="absolute -top-20 left-4 bg-slate-800 p-2 rounded-lg border border-slate-700 shadow-xl flex gap-2 animate-in slide-in-from-bottom-2">
              <img src={attachedImage} alt="Preview" className="h-16 w-16 object-cover rounded" />
              <button
                onClick={removeImage}
                className="bg-red-500 rounded-full p-1 h-6 w-6 flex items-center justify-center text-white hover:bg-red-600 transition"
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
              title="Upload Image"
            >
              <ImageIcon size={20} />
            </button>
            <button
              type="button"
              onClick={() => cameraInputRef.current.click()}
              className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-indigo-400 transition md:hidden"
              title="Camera"
            >
              <Camera size={20} />
            </button>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={loading}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none placeholder:text-slate-600 transition shadow-inner"
              placeholder="Type your message..."
            />
            <button
              type="submit"
              disabled={(!input.trim() && !attachedImage) || loading}
              className="bg-indigo-600 hover:bg-indigo-700 px-4 py-3 rounded-xl text-white transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/20"
            >
              <Send size={20} />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { Send, Bot, User, Trash2, Camera, Image as ImageIcon, X, Menu, MessageSquare } from 'lucide-react'
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

  useEffect(() => { fetchLibraryModels(); fetchChatHistory() }, [])
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function fetchLibraryModels() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('user_models').select('ai_models (*)').eq('user_id', user.id)
    if (data) {
        const list = data.map(i => i.ai_models).filter(Boolean)
        setModels(list)
        if (!selectedModel && list.length) setSelectedModel(list[0])
    }
  }

  async function fetchChatHistory() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('chat_history').select('*').eq('user_id', user.id).order('created_at', { ascending: true })
    if (data) setMessages(data)
  }

  async function handleSend(e) {
    e.preventDefault()
    if ((!input.trim() && !attachedImage) || !selectedModel) return
    const text = input; const image = attachedImage
    setInput(''); setAttachedImage(null); setLoading(true)
    
    setMessages(p => [...p, { role: 'user', content: text, image }])
    const { data: { user } } = await supabase.auth.getUser()
    if (user) await supabase.from('chat_history').insert({ user_id: user.id, role: 'user', content: text + (image ? ' [Image]' : ''), model_id: selectedModel.id })

    try {
      const { data, error } = await supabase.functions.invoke('chat-engine', { body: { message: text, model_id: selectedModel.id } })
      if (error) throw error
      const reply = data.reply || "No response."
      if (user) await supabase.from('chat_history').insert({ user_id: user.id, role: 'ai', content: reply, model_id: selectedModel.id })
      setMessages(p => [...p, { role: 'ai', content: reply }])
    } catch (err) {
      console.error(err)
      setMessages(p => [...p, { role: 'system', content: 'Connection Error' }])
    } finally { setLoading(false) }
  }

  return (
    <div className="flex h-[calc(100vh-80px)] bg-slate-950 text-white overflow-hidden relative font-sans">
      <input type="file" ref={fileInputRef} onChange={e => {
          const file = e.target.files?.[0]; if(file) { const r = new FileReader(); r.onloadend = () => setAttachedImage(r.result); r.readAsDataURL(file) }
      }} className="hidden" />

      {isSidebarOpen && <div className="absolute inset-0 z-50 bg-slate-900 p-4 pt-12 md:hidden"><button onClick={()=>setIsSidebarOpen(false)} className="absolute top-4 right-4"><X/></button>{models.map(m=><button key={m.id} onClick={()=>{setSelectedModel(m);setIsSidebarOpen(false)}} className="w-full text-left p-4 border border-slate-800 mb-2">{m.name}</button>)}</div>}

      <div className="w-72 bg-slate-900 border-r border-slate-800 p-4 hidden md:block">
        <h2 className="text-xs font-bold text-slate-400 mb-4">CHAT MODELS</h2>
        {models.map(m => <button key={m.id} onClick={() => setSelectedModel(m)} className={`w-full text-left p-3 rounded mb-2 ${selectedModel?.id===m.id?'bg-indigo-900 border-indigo-500 border':'hover:bg-slate-800'}`}>{m.name}</button>)}
      </div>

      <div className="flex-1 flex flex-col relative mt-8">
        <div className="h-16 border-b border-slate-800 flex items-center justify-between px-4">
            <div className="flex gap-2 items-center"><button onClick={()=>setIsSidebarOpen(true)} className="md:hidden"><Menu/></button><span className="font-bold">{selectedModel?.name || 'Select Model'}</span></div>
            <Link to="/marketplace" className="text-sm bg-slate-800 px-3 py-1 rounded">Go to Marketplace for Calls</Link>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((m,i)=><div key={i} className={`p-3 rounded-lg max-w-[85%] ${m.role==='user'?'ml-auto bg-indigo-600':'bg-slate-800'}`}>{m.image&&<img src={m.image} className="rounded mb-2"/>}{m.content}</div>)}
            <div ref={messagesEndRef}/>
        </div>
        <form onSubmit={handleSend} className="p-4 bg-slate-900 border-t border-slate-800 flex gap-2">
            {attachedImage && <div className="absolute bottom-20 left-4 bg-slate-800 p-2 border"><img src={attachedImage} className="h-10 w-10"/><button onClick={()=>setAttachedImage(null)}><X size={12}/></button></div>}
            <button type="button" onClick={()=>fileInputRef.current.click()} className="p-3 bg-slate-800 rounded"><ImageIcon/></button>
            <input value={input} onChange={e=>setInput(e.target.value)} className="flex-1 bg-slate-950 border border-slate-700 rounded px-4" placeholder="Type..." />
            <button type="submit" className="bg-indigo-600 px-4 rounded"><Send/></button>
        </form>
      </div>
    </div>
  )
}
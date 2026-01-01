import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { 
  Phone, PhoneOff, ShoppingCart, Loader2, Search, 
  TrendingUp, Sparkles, Heart, Server, Zap
} from 'lucide-react'

// ⚠️ KEYS
const VAPI_PUBLIC_KEY = '150fa8ac-12a5-48fb-934f-0a9bbadc2da7'
const VAPI_ASSISTANT_ID = 'Be1bcb56-7536-493b-bca9-3261cf8e11b6'

export default function Marketplace() {
  const [models, setModels] = useState([])
  const [loading, setLoading] = useState(true)
  const [isCalling, setIsCalling] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState('Ready')
  const [purchasing, setPurchasing] = useState(null)
  
  const vapiRef = useRef(null)

  // 1. INITIALIZE VAPI
  useEffect(() => {
    let vapiInstance = null;
    const initVapi = async () => {
      try {
        const VAPI_URL = "https://esm.sh/@vapi-ai/web"
        const module = await import(/* @vite-ignore */ VAPI_URL)
        const VapiClass = module.default || module.Vapi
        vapiInstance = new VapiClass(VAPI_PUBLIC_KEY)
        vapiRef.current = vapiInstance

        vapiInstance.on('call-start', () => { setIsCalling(true); setVoiceStatus('Connected'); })
        vapiInstance.on('call-end', () => { setIsCalling(false); setVoiceStatus('Ready'); })
        
        // Error Handling
        vapiInstance.on('error', (e) => { 
            console.error("Vapi Error:", e);
            let msg = "Unknown Error";
            try {
                if (typeof e === 'string') msg = e;
                else if (e.message) msg = e.message;
                else if (e.error && e.error.message) msg = e.error.message;
                else msg = JSON.stringify(e);
            } catch(err) {}
            
            setVoiceStatus(`Err: ${msg.substring(0, 30)}`); 
            setIsCalling(false); 
        })

      } catch (err) { console.error(err) }
    }
    initVapi()
    return () => { if (vapiRef.current) vapiRef.current.stop() }
  }, [])

  // 2. FETCH MODELS
  useEffect(() => {
    async function fetchModels() {
      try {
        setLoading(true)
        const { data, error } = await supabase.from('ai_models').select('*')
        if (!error) setModels(data || [])
      } finally { setLoading(false) }
    }
    fetchModels()
  }, [])

  // 3. HANDLE CALL (FORCE NO SERVER to fix 400 Error)
  const handleGeneralCall = async () => {
    if (!vapiRef.current) return
    if (isCalling) { vapiRef.current.stop(); return }

    setVoiceStatus('Connecting...')
    try {
        await vapiRef.current.start(VAPI_ASSISTANT_ID, {
            serverUrl: null, // Prevents call from routing to Supabase
        })
    } 
    catch (err) { 
        setVoiceStatus('Failed to start'); 
        setIsCalling(false);
    }
  }

  // 4. ADD TO LIBRARY
  async function handleAddToLibrary(modelId) {
    setPurchasing(modelId)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { alert("Please log in!"); setPurchasing(null); return }
    
    // Check if already exists
    const { data: existing } = await supabase.from('user_models').select('*').eq('user_id', user.id).eq('model_id', modelId)
    if (existing && existing.length > 0) {
        alert("Already in your Library!");
        setPurchasing(null);
        return;
    }

    const { error } = await supabase.from('user_models').insert([{ user_id: user.id, model_id: modelId }])
    if (error) alert("Error: " + error.message)
    else alert("Added to Library! 🚀")
    setPurchasing(null)
  }

  // Logic to split models
  const trending = models.slice(0, 3)
  const newArrivals = models.slice(3, 6)
  const mostLiked = models.slice(0, 5).reverse().slice(0, 3)

  // Reusable List Card
  const ModelRow = ({ model, color, bg }) => (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 mb-3 hover:border-indigo-500/30 hover:bg-slate-800 transition flex items-center justify-between group">
      <div className="flex items-center gap-4 overflow-hidden">
         <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${bg} ${color} bg-opacity-10 text-xl font-bold`}>
            {model.name[0]}
         </div>
         <div className="min-w-0">
            <h4 className="font-bold text-base truncate text-slate-200 group-hover:text-white transition">{model.name}</h4>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                <span className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">{model.provider}</span>
                <span>• ${model.input_price_1k}/1k</span>
            </div>
         </div>
      </div>
      <button 
        onClick={() => handleAddToLibrary(model.id)}
        disabled={purchasing === model.id}
        className="ml-3 h-10 w-10 flex items-center justify-center bg-slate-800 hover:bg-indigo-600 hover:text-white rounded-full text-slate-400 transition shrink-0 border border-slate-700 hover:border-indigo-500"
      >
        {purchasing === model.id ? <Loader2 size={18} className="animate-spin"/> : <ShoppingCart size={18}/>}
      </button>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8 pb-32 font-sans selection:bg-indigo-500/30">
      
      {/* HERO: VOICE CALL */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 border border-indigo-500/20 rounded-3xl p-8 md:p-12 mb-16 text-center shadow-2xl shadow-indigo-900/20">
         <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none"/>
         
         <div className="relative z-10 flex flex-col items-center">
             <div className="mb-6 p-4 bg-indigo-500/10 rounded-full border border-indigo-500/20 animate-pulse">
                <Zap className="text-indigo-400" size={32} fill="currentColor"/>
             </div>
             <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">AI Voice Assistant</h1>
             <p className="text-indigo-200/60 text-lg mb-8 max-w-xl mx-auto">
                One click to connect with our advanced AI model.
             </p>
             
             <button 
                onClick={handleGeneralCall}
                className={`relative group px-10 py-5 rounded-full font-bold text-lg shadow-xl transition-all flex items-center gap-4 ${
                    isCalling 
                    ? 'bg-red-500 hover:bg-red-600 text-white' 
                    : 'bg-white text-slate-950 hover:scale-105'
                }`}
             >
                {isCalling ? <PhoneOff size={24}/> : <Phone size={24}/>}
                <span>{isCalling ? 'End Session' : 'Start Voice Call'}</span>
             </button>
             <p className={`mt-4 text-xs font-mono tracking-wider uppercase ${voiceStatus.includes('Err') || voiceStatus.includes('Fail') ? 'text-red-400' : 'text-indigo-400/50'}`}>
                {voiceStatus}
             </p>
         </div>
      </div>

      {/* LISTS */}
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-end mb-8 border-b border-slate-800 pb-4 gap-4">
             <div><h2 className="text-2xl font-bold flex items-center gap-3"><Server className="text-indigo-500"/> AI Models Library</h2></div>
             <div className="flex items-center gap-3 bg-slate-900 px-4 py-2 rounded-full border border-slate-800 w-full md:w-auto">
                 <Search className="text-slate-500" size={18}/>
                 <input placeholder="Filter models..." className="bg-transparent outline-none text-sm w-full md:w-48 placeholder:text-slate-600" />
             </div>
        </div>

        {!loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div>
                    <h3 className="flex items-center gap-2 font-bold text-sm text-amber-400 uppercase tracking-wider mb-4"><TrendingUp size={16}/> Trending</h3>
                    {trending.map(m => <ModelRow key={m.id} model={m} color="text-amber-400" bg="bg-amber-400" />)}
                </div>
                <div>
                    <h3 className="flex items-center gap-2 font-bold text-sm text-purple-400 uppercase tracking-wider mb-4"><Sparkles size={16}/> New Arrivals</h3>
                    {newArrivals.map(m => <ModelRow key={m.id} model={m} color="text-purple-400" bg="bg-purple-400" />)}
                </div>
                <div>
                    <h3 className="flex items-center gap-2 font-bold text-sm text-pink-400 uppercase tracking-wider mb-4"><Heart size={16}/> Most Popular</h3>
                    {mostLiked.map(m => <ModelRow key={m.id} model={m} color="text-pink-400" bg="bg-pink-400" />)}
                </div>
            </div>
        )}
      </div>
    </div>
  )
}
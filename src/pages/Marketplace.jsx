import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { 
  Phone, PhoneOff, Star, TrendingUp, Search, Loader2, Server, AlertTriangle 
} from 'lucide-react'

// ⚠️ KEYS
const VAPI_PUBLIC_KEY = '150fa8ac-12a5-48fb-934f-0a9bbadc2da7'
const VAPI_ASSISTANT_ID = 'Be1bcb56-7536-493b-bca9-3261cf8e11b6'

export default function Marketplace() {
  const [models, setModels] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState(null)
  const [activeCall, setActiveCall] = useState(null)
  const [voiceStatus, setVoiceStatus] = useState('Ready')
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

        vapiInstance.on('call-start', () => setVoiceStatus('Connected'))
        vapiInstance.on('call-end', () => { setActiveCall(null); setVoiceStatus('Ready') })
        vapiInstance.on('error', (e) => { console.error(e); setVoiceStatus('Error'); setActiveCall(null) })
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
        if (error) setErrorMsg(error.message)
        else setModels(data || [])
      } catch (err) { setErrorMsg(err.message) }
      finally { setLoading(false) }
    }
    fetchModels()
  }, [])

  // 3. HANDLE CALL
  const handleCall = async (model) => {
    if (!vapiRef.current) return
    if (activeCall?.id === model.id) { vapiRef.current.stop(); setActiveCall(null); return }
    
    setActiveCall(model); setVoiceStatus('Connecting...')
    try {
        const { data: { user } } = await supabase.auth.getUser()
        await vapiRef.current.start(VAPI_ASSISTANT_ID, { variableValues: { userId: user?.id, modelId: model.id } })
    } catch (err) { console.error(err); setVoiceStatus('Failed'); setActiveCall(null) }
  }

  // 4. RENDER UI
  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8 pb-32 font-sans">
      <div className="max-w-7xl mx-auto mb-10">
        <h1 className="text-4xl font-bold text-indigo-400">AI Marketplace</h1>
        <p className="text-slate-400">Discover & Talk to Experts</p>
      </div>

      {!loading && models.length > 0 && (
        <div className="max-w-7xl mx-auto mb-16 bg-indigo-900/20 p-8 rounded-3xl border border-indigo-500/30">
            <h2 className="text-xl font-bold mb-4 text-amber-400 flex gap-2"><TrendingUp/> Trending</h2>
            <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="w-24 h-24 bg-indigo-600 rounded-2xl flex items-center justify-center text-4xl font-bold">{models[0].name[0]}</div>
                <div className="flex-1">
                    <h3 className="text-3xl font-bold">{models[0].name}</h3>
                    <p className="text-indigo-200">{models[0].description}</p>
                </div>
                <button onClick={() => handleCall(models[0])} className={`px-8 py-3 rounded-full font-bold flex gap-3 ${activeCall?.id === models[0].id ? 'bg-red-500' : 'bg-white text-indigo-900'}`}>
                    {activeCall?.id === models[0].id ? <PhoneOff/> : <Phone fill="currentColor"/>} {activeCall?.id === models[0].id ? 'End Call' : 'Call Now'}
                </button>
            </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {models.map((model) => (
            <div key={model.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-indigo-500 transition">
                <h3 className="font-bold text-xl mb-2">{model.name}</h3>
                <p className="text-sm text-slate-400 mb-6">{model.description}</p>
                <button onClick={() => handleCall(model)} className={`w-full py-2 rounded-lg font-bold ${activeCall?.id === model.id ? 'bg-red-500/20 text-red-400' : 'bg-indigo-600'}`}>
                    {activeCall?.id === model.id ? 'Hang Up' : 'Call Now'}
                </button>
            </div>
        ))}
      </div>
      
      {activeCall && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 border border-indigo-500 rounded-full px-6 py-3 flex items-center gap-4 z-50">
            <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"/>
            <span className="font-bold">Talking to {activeCall.name}</span>
            <button onClick={() => handleCall(activeCall)} className="bg-red-500 p-2 rounded-full"><PhoneOff size={18}/></button>
        </div>
      )}
    </div>
  )
}
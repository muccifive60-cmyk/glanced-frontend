import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { ShoppingCart, Server, AlertTriangle } from 'lucide-react'

export default function Marketplace() {
  const [models, setModels] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState(null)
  
  // New state to track which item is being purchased
  const [purchasing, setPurchasing] = useState(null)

  useEffect(() => {
    fetchModels()
  }, [])

  async function fetchModels() {
    try {
      setLoading(true)
      console.log("Starting fetch...")

      const { data, error } = await supabase
        .from('ai_models')
        .select('*')
      
      if (error) {
        console.error("Supabase Error:", error)
        setErrorMsg("Error: " + error.message)
      } else {
        console.log("Data received:", data)
        if (data.length === 0) {
          setErrorMsg("Success: Connected to Database, but found 0 items inside 'ai_models' table.")
        } else {
          setModels(data)
          setErrorMsg(null)
        }
      }
    } catch (err) {
      setErrorMsg("Critical Error: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  // New function to handle the button click
  async function handleAddToLibrary(modelId) {
    setPurchasing(modelId)
    
    // 1. Get current user
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      alert("Please log in to add models!")
      setPurchasing(null)
      return
    }

    // 2. Insert into database
    const { error } = await supabase
      .from('user_models')
      .insert([
        { user_id: user.id, model_id: modelId }
      ])

    if (error) {
      alert("Error: " + error.message)
    } else {
      alert("Model added successfully! 🚀")
    }
    
    setPurchasing(null)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-8 font-sans">
      
      <div className="max-w-6xl mx-auto mb-12 text-center">
        <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">AI Model Marketplace</h1>
        <p className="text-slate-400 text-lg">Browse and activate premium AI models for your applications.</p>
        
        {errorMsg && (
          <div className="mt-6 p-4 bg-red-500/10 border border-red-500 rounded-lg text-red-200 inline-block">
            <div className="flex items-center gap-2">
              <AlertTriangle size={20} />
              <span className="font-mono text-sm">{errorMsg}</span>
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div className="text-center py-20">
          <div className="animate-spin w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-500">Connecting to Supabase...</p>
        </div>
      )}

      {!loading && !errorMsg && (
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {models.map((model) => (
            <div key={model.id} className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-indigo-500/50 transition duration-300 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-slate-800 rounded-lg text-indigo-400">
                  <Server size={24} />
                </div>
                <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-full uppercase tracking-wider">
                  Active
                </span>
              </div>
              
              <h3 className="text-xl font-bold text-white mb-2">{model.name}</h3>
              <p className="text-slate-400 text-sm mb-6 flex-grow">{model.description}</p>
              
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Provider</span>
                  <span className="text-slate-300 font-medium">{model.provider}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Price (Input)</span>
                  <span className="text-slate-300 font-mono">${model.input_price_1k} / 1k</span>
                </div>
              </div>

              <button 
                onClick={() => handleAddToLibrary(model.id)}
                disabled={purchasing === model.id}
                className={`w-full py-3 font-bold rounded-lg transition flex items-center justify-center gap-2 mt-auto
                  ${purchasing === model.id ? 'bg-indigo-600 text-white' : 'bg-white text-slate-950 hover:bg-indigo-50'}
                `}
              >
                {purchasing === model.id ? (
                  <span>Processing...</span>
                ) : (
                  <>
                    <ShoppingCart size={18} />
                    Add to Library
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../utils/supabase/client'
import { Search, Cpu, Zap, Box } from 'lucide-react'

export default function Marketplace() {
  const [models, setModels] = useState([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchModels = async () => {
      // Fetch models from Supabase
      const { data, error } = await supabase
        .from('ai_models')
        .select('*')
        .eq('is_active', true)
      
      if (data) setModels(data)
      setLoading(false)
    }
    fetchModels()
  }, [])

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-8">
      
      {/* HEADER */}
      <div className="max-w-6xl mx-auto mb-12 text-center">
        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 mb-4">
          Global AI Marketplace
        </h1>
        <p className="text-slate-400 text-lg">
          Access the world's best AI models through a single API.
        </p>
      </div>

      {/* MODELS GRID */}
      {loading ? (
        <div className="text-center text-slate-500 animate-pulse">Loading Marketplace...</div>
      ) : (
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {models.length === 0 ? (
            <div className="col-span-full text-center py-20 bg-slate-800/50 rounded-2xl border border-dashed border-slate-700">
              <p className="text-slate-500">No active models found in database.</p>
            </div>
          ) : (
            models.map((model) => (
              <div key={model.id} className="bg-slate-800 rounded-xl border border-slate-700 p-6 hover:border-indigo-500 hover:shadow-lg transition group cursor-pointer">
                
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-indigo-500/10 rounded-lg text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition">
                    <Cpu size={24} />
                  </div>
                  <span className="text-xs font-mono bg-slate-900 text-slate-400 px-2 py-1 rounded border border-slate-700">
                    {model.provider}
                  </span>
                </div>

                <h3 className="text-xl font-bold text-white mb-2">{model.name}</h3>
                <p className="text-slate-400 text-sm mb-6 h-10 overflow-hidden text-ellipsis">
                  {model.description}
                </p>

                <div className="space-y-2 bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 flex items-center"><Zap size={12} className="mr-1"/> Input</span>
                    <span className="text-slate-300 font-mono">${model.input_price_1k} / 1k</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 flex items-center"><Box size={12} className="mr-1"/> Output</span>
                    <span className="text-slate-300 font-mono">${model.output_price_1k} / 1k</span>
                  </div>
                </div>

              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

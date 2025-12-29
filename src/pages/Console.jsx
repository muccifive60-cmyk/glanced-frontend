import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { Key, Copy, Plus, Trash2, Activity, Box, DollarSign, BarChart3, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Console() {
  const [apiKeys, setApiKeys] = useState([])
  const [myModels, setMyModels] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [newKey, setNewKey] = useState(null)
  const [errorMsg, setErrorMsg] = useState(null)

  // Stats (Placeholder for now)
  const stats = {
    revenue: 0.00,
    calls: 0,
    active_keys: apiKeys.length
  }

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: keys, error: keysError } = await supabase
        .from('api_keys')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (keysError) throw keysError

      const { data: models, error: modelsError } = await supabase
        .from('ai_models')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })

      if (keys) setApiKeys(keys)
      if (models) setMyModels(models)

    } catch (error) {
      console.error('Error fetching data:', error)
      setErrorMsg(error.message)
    } finally {
      setLoading(false)
    }
  }

  async function generateKey() {
    setGenerating(true)
    setErrorMsg(null)
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const randomString = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
      const keyString = `glance_sk_${randomString}`

      const { data, error } = await supabase
        .from('api_keys')
        .insert([{ 
            user_id: user.id, 
            key_string: keyString, 
            name: 'My Secret Key',
            is_active: true
        }])
        .select()
        .single()

      if (error) throw error

      setApiKeys([data, ...apiKeys])
      setNewKey(keyString)

    } catch (err) {
      alert('Failed: ' + err.message)
    } finally {
      setGenerating(false)
    }
  }

  async function deleteKey(id) {
    if(!confirm("Are you sure? This will break any apps using this key.")) return
    await supabase.from('api_keys').delete().eq('id', id)
    setApiKeys(apiKeys.filter(k => k.id !== id))
  }

  return (
    <div className="max-w-6xl mx-auto p-8 text-white">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Developer Console</h1>
        <p className="text-slate-400">Track your earnings and manage API access.</p>
        
        {errorMsg && (
          <div className="mt-4 p-3 bg-red-900/50 border border-red-500 rounded text-red-200 text-sm">
            System Error: {errorMsg}
          </div>
        )}
      </div>

      {/* DASHBOARD STATS (NEW SECTION) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex items-center justify-between">
            <div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Revenue</p>
                <h3 className="text-3xl font-bold text-white mt-1 flex items-baseline gap-1">
                    ${stats.revenue.toFixed(2)}
                </h3>
            </div>
            <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center text-green-400">
                <DollarSign size={24} />
            </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex items-center justify-between">
            <div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total API Calls</p>
                <h3 className="text-3xl font-bold text-white mt-1">
                    {stats.calls}
                </h3>
            </div>
            <div className="w-12 h-12 bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-400">
                <Activity size={24} />
            </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex items-center justify-between">
            <div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Net Profit</p>
                <h3 className="text-3xl font-bold text-green-400 mt-1">
                    +0.0%
                </h3>
            </div>
            <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center text-purple-400">
                <TrendingUp size={24} />
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* API KEYS SECTION */}
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Key className="text-green-400" size={20}/> API Keys
            </h2>
            <button 
              onClick={generateKey}
              disabled={generating}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition"
            >
              {generating ? "Creating..." : "Generate New Key"}
            </button>
          </div>

          {newKey && (
            <div className="bg-green-900/30 border border-green-500/50 p-4 rounded-xl mb-4 animate-in fade-in slide-in-from-top-2">
              <p className="text-green-400 text-xs font-bold uppercase mb-2">New Key (Copy Now)</p>
              <div className="flex items-center justify-between bg-black/50 p-3 rounded-lg font-mono text-sm">
                <span className="truncate text-white">{newKey}</span>
                <button onClick={() => navigator.clipboard.writeText(newKey)} className="text-slate-400 hover:text-white">
                  <Copy size={16}/>
                </button>
              </div>
            </div>
          )}

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden min-h-[150px]">
            {!apiKeys || apiKeys.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                No active keys found.
              </div>
            ) : (
              apiKeys.map(key => (
                <div key={key.id} className="p-4 border-b border-slate-800 last:border-0 flex justify-between items-center hover:bg-slate-800/50 transition">
                  <div>
                    <div className="font-medium text-white">{key.name || 'Secret Key'}</div>
                    <div className="font-mono text-xs text-slate-500 mt-1 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                      {(key.key_string || "Invalid").substring(0, 15)}...
                    </div>
                  </div>
                  <button onClick={() => deleteKey(key.id)} className="text-slate-500 hover:text-red-400 transition">
                    <Trash2 size={16}/>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* MY MODELS SECTION */}
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Box className="text-indigo-400" size={20}/> My Agents
            </h2>
            <Link to="/publish" className="text-indigo-400 hover:text-white text-sm border border-indigo-500/30 px-3 py-1 rounded-full">
              + Publish New
            </Link>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden min-h-[150px]">
            {!myModels || myModels.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm flex flex-col items-center justify-center h-full">
                <p>No agents published yet.</p>
              </div>
            ) : (
              myModels.map(model => (
                <div key={model.id} className="p-4 border-b border-slate-800 last:border-0 flex justify-between items-center hover:bg-slate-800/50 transition">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-lg">
                        {model.name ? model.name.charAt(0) : "A"}
                     </div>
                     <div>
                        <div className="font-medium text-white">{model.name}</div>
                        <div className="text-xs text-slate-500 mt-1">
                             ${model.input_price_1k || '0'}/1k
                        </div>
                     </div>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500">
                    <BarChart3 size={14}/>
                    <span className="text-xs">0 calls</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
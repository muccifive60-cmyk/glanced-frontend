import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { CheckCircle, XCircle, BarChart3, Trash2, ShieldAlert } from 'lucide-react'

export default function Dashboard() {
  const [myModels, setMyModels] = useState([])
  const [pendingModels, setPendingModels] = useState([]) 
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  async function fetchDashboardData() {
    // 1. Get current user
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)

    if (user) {
      // 2. Fetch User's Models (Developer View)
      const { data: myData } = await supabase
        .from('ai_models')
        .select('*')
        .eq('owner_id', user.id)
      
      if (myData) setMyModels(myData)

      // 3. Fetch Pending Models (Admin View)
      // Showing all inactive models not owned by current user
      const { data: pendingData } = await supabase
        .from('ai_models')
        .select('*')
        .eq('is_active', false)
        .neq('owner_id', user.id) 
      
      if (pendingData) setPendingModels(pendingData)
    }
    setLoading(false)
  }

  // Action: Approve Model
  async function approveModel(id) {
    const { error } = await supabase
      .from('ai_models')
      .update({ is_active: true })
      .eq('id', id)

    if (!error) {
      alert("Model Approved! It is now visible in the Marketplace.")
      fetchDashboardData() // Refresh data
    } else {
      alert("Error: " + error.message)
    }
  }

  // Action: Reject/Delete Model
  async function deleteModel(id) {
    if(!confirm("Are you sure you want to reject and delete this model?")) return;

    const { error } = await supabase
      .from('ai_models')
      .delete()
      .eq('id', id)

    if (!error) {
      fetchDashboardData() // Refresh data
    } else {
      alert("Error: " + error.message)
    }
  }

  if (loading) return <div className="text-white p-8">Loading Console...</div>

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-12">
        
        {/* HEADER */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Developer Console</h1>
          <p className="text-slate-400">Manage your AI models and view performance.</p>
        </div>

        {/* SECTION 1: ADMIN AREA (Pending Approvals) */}
        {pendingModels.length > 0 && (
          <div className="bg-slate-900 border border-yellow-500/30 rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-yellow-500"></div>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <ShieldAlert className="text-yellow-500" />
              Admin Review Queue <span className="text-sm font-normal text-slate-400">(Actions Required)</span>
            </h2>
            
            <div className="grid gap-4">
              {pendingModels.map(model => (
                <div key={model.id} className="bg-slate-950 p-4 rounded-xl flex justify-between items-center border border-slate-800">
                  <div>
                    <h3 className="font-bold text-white">{model.name}</h3>
                    <p className="text-sm text-slate-400">{model.description}</p>
                    <div className="flex gap-4 mt-2 text-xs font-mono text-slate-500">
                      <span>Provider: {model.provider}</span>
                      <span>ID: {model.id.slice(0,8)}...</span>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => deleteModel(model.id)}
                      className="flex items-center gap-1 px-4 py-2 bg-red-900/30 text-red-400 rounded-lg hover:bg-red-900/50 transition border border-red-900"
                    >
                      <XCircle size={16} /> Reject
                    </button>
                    <button 
                      onClick={() => approveModel(model.id)}
                      className="flex items-center gap-1 px-4 py-2 bg-green-900/30 text-green-400 rounded-lg hover:bg-green-900/50 transition border border-green-900"
                    >
                      <CheckCircle size={16} /> Approve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 2: DEVELOPER AREA (My Models) */}
        <div>
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <BarChart3 className="text-indigo-400" />
            My Published Models
          </h2>

          {myModels.length === 0 ? (
             <div className="text-center py-12 bg-slate-900 rounded-2xl border border-dashed border-slate-800">
               <p className="text-slate-500">You haven't published any models yet.</p>
             </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myModels.map(model => (
                <div key={model.id} className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-indigo-500/50 transition group">
                  
                  <div className="flex justify-between items-start mb-4">
                    <div className={`px-3 py-1 rounded-full text-xs font-bold border ${
                      model.is_active 
                        ? 'bg-green-900/20 text-green-400 border-green-900' 
                        : 'bg-yellow-900/20 text-yellow-400 border-yellow-900'
                    }`}>
                      {model.is_active ? 'LIVE' : 'PENDING REVIEW'}
                    </div>
                    {/* Delete Button for Owner */}
                    <button onClick={() => deleteModel(model.id)} className="text-slate-600 hover:text-red-400 transition">
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <h3 className="text-lg font-bold text-white mb-1">{model.name}</h3>
                  <p className="text-sm text-slate-400 line-clamp-2 h-10 mb-4">{model.description}</p>
                  
                  {/* Earnings Simulation Stats */}
                  <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-800">
                    <div>
                      <p className="text-xs text-slate-500 uppercase">Price</p>
                      <p className="font-mono text-white">${model.input_price_1k}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase">Est. Earnings</p>
                      <p className="font-mono text-green-400">
                        {/* Simulation: Dummy earnings for now */}
                        ${model.is_active ? (Math.random() * 50).toFixed(2) : '0.00'}
                      </p>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { Upload, DollarSign, Cpu, Save, ShieldCheck } from 'lucide-react'

export default function Publish() {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    system_prompt: '',
    input_price: '0.005',
    provider: 'Google', 
    is_private: false
  })

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        alert("You must be logged in to publish an AI.")
        setLoading(false)
        return
      }

      // 1. Insert into Database
      const { error } = await supabase
        .from('ai_models')
        .insert([
          {
            name: formData.name,
            description: formData.description,
            system_prompt: formData.system_prompt,
            input_price_1k: parseFloat(formData.input_price),
            provider: formData.provider,
            owner_id: user.id, // Links the AI to the creator
            is_verified: false // New models pending approval
          }
        ])

      if (error) throw error

      alert("AI Model Published Successfully! It is now live in the Marketplace.")
      setFormData({ name: '', description: '', system_prompt: '', input_price: '0.005', provider: 'Google', is_private: false })

    } catch (error) {
      console.error('Error publishing:', error)
      alert(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-8 text-white">
      <div className="mb-8 border-b border-slate-800 pb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Upload className="text-indigo-500" /> Publish New AI Agent
        </h1>
        <p className="text-slate-400 mt-2">
          Create specialized AI models for the US & EU markets. Define the personality, rules, and pricing.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Agent Name</label>
            <input 
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 focus:border-indigo-500 focus:outline-none"
              placeholder="e.g., California Tax Expert"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Base Engine</label>
            <div className="relative">
              <Cpu className="absolute left-3 top-3 text-slate-500" size={18}/>
              <select 
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 pl-10 focus:border-indigo-500 focus:outline-none appearance-none"
                value={formData.provider}
                onChange={e => setFormData({...formData, provider: e.target.value})}
              >
                <option value="Google">Google Gemini (Flash)</option>
                <option value="OpenAI" disabled>OpenAI GPT-4 (Coming Soon)</option>
              </select>
            </div>
          </div>
        </div>

        {/* System Prompt - THE BRAIN */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-indigo-400 flex items-center gap-2">
             System Prompt (The Brain) <ShieldCheck size={14} />
          </label>
          <p className="text-xs text-slate-500 mb-2">
            This is the secret instruction that makes your AI unique. Example: "You are a senior legal advisor specializing in EU GDPR compliance..."
          </p>
          <textarea 
            required
            rows={6}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-4 font-mono text-sm focus:border-indigo-500 focus:outline-none"
            placeholder="Define the AI's persona, rules, and knowledge base here..."
            value={formData.system_prompt}
            onChange={e => setFormData({...formData, system_prompt: e.target.value})}
          />
        </div>

        {/* Description & Pricing */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Public Description</label>
            <textarea 
              required
              rows={3}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 focus:border-indigo-500 focus:outline-none"
              placeholder="What does this AI do? (Visible to customers)"
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
            />
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-green-400 flex items-center gap-2">
                <DollarSign size={14}/> Price per 1k Tokens ($)
              </label>
              <input 
                type="number"
                step="0.001"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 focus:border-green-500 focus:outline-none"
                value={formData.input_price}
                onChange={e => setFormData({...formData, input_price: e.target.value})}
              />
              <p className="text-xs text-slate-500">Recommended: $0.005 - $0.050 based on value.</p>
            </div>
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl transition flex items-center justify-center gap-2"
        >
          {loading ? 'Publishing...' : <><Save size={20} /> Publish to Marketplace</>}
        </button>
      </form>
    </div>
  )
}
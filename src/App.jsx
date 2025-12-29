import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { LogOut, LayoutDashboard, ShoppingBag, Terminal, Upload } from 'lucide-react'

// Import Pages
import Login from './pages/Login'
import Marketplace from './pages/Marketplace'
import Dashboard from './pages/Dashboard'
import Playground from './pages/Playground'
import PublishModel from './pages/PublishModel'
import Console from './pages/Console' // New Import

export default function App() {
  const [session, setSession] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Show Login if not authenticated
  if (!session) {
    return <Login />
  }

  return (
    <Router>
      <div className="min-h-screen bg-slate-950 text-slate-200 font-sans">
        
        {/* TOP NAVIGATION BAR */}
        <nav className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
          <div className="flex items-center gap-8">
            <h1 className="text-xl font-bold text-white tracking-tight">GlanceID</h1>
            <div className="hidden md:flex gap-6 text-sm font-medium">
              <Link to="/marketplace" className="flex items-center gap-2 hover:text-white transition">
                <ShoppingBag size={16} /> Marketplace
              </Link>
              
              {/* Updated Console Link */}
              <Link to="/console" className="flex items-center gap-2 hover:text-white transition">
                <LayoutDashboard size={16} /> Console
              </Link>

              <Link to="/playground" className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 transition">
                <Terminal size={16} /> Playground
              </Link>
              <Link to="/publish" className="flex items-center gap-2 hover:text-white transition">
                <Upload size={16} /> Publish
              </Link>
            </div>
          </div>
          
          <button 
            onClick={() => supabase.auth.signOut()} 
            className="text-slate-400 hover:text-white transition"
          >
            <LogOut size={20} />
          </button>
        </nav>

        {/* MAIN CONTENT AREA */}
        <Routes>
          <Route path="/" element={<Marketplace />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/playground" element={<Playground />} />
          <Route path="/publish" element={<PublishModel />} />
          <Route path="/console" element={<Console />} /> {/* New Route */}
        </Routes>
        
      </div>
    </Router>
  )
}
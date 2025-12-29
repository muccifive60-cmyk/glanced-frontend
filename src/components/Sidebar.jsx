import { Link, useLocation } from 'react-router-dom'
import { MessageSquare, Upload, Terminal, Settings, LogOut } from 'lucide-react'

export default function Sidebar() {
  const location = useLocation()
  
  const isActive = (path) => location.pathname === path ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"

  return (
    <div className="w-64 h-screen bg-slate-900 border-r border-slate-800 fixed left-0 top-0 flex flex-col p-4">
      {/* Logo */}
      <div className="flex items-center gap-3 px-2 mb-8 mt-2">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white">G</div>
        <span className="font-bold text-lg tracking-tight text-white">GlanceID</span>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-2">
        <Link to="/" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition font-medium ${isActive('/')}`}>
          <MessageSquare size={20} />
          Playground
        </Link>

        <Link to="/publish" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition font-medium ${isActive('/publish')}`}>
          <Upload size={20} />
          Marketplace
        </Link>

        <Link to="/console" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition font-medium ${isActive('/console')}`}>
          <Terminal size={20} />
          Console
        </Link>
      </nav>

      {/* Bottom Actions */}
      <div className="pt-4 border-t border-slate-800 space-y-2">
        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition">
          <Settings size={20} />
          Settings
        </button>
        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:bg-red-900/20 hover:text-red-400 transition">
          <LogOut size={20} />
          Sign Out
        </button>
      </div>
    </div>
  )
}
import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Key, CreditCard, LogOut, Plus, RefreshCw, ChevronDown } from 'lucide-react';

const Dashboard = () => {
  const [businesses, setBusinesses] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetchBusinesses();
  }, []);

  useEffect(() => {
    if (selectedBusiness) {
      fetchApiKeys(selectedBusiness.id);
    }
  }, [selectedBusiness]);

  const fetchBusinesses = async () => {
    try {
      // Dynamic fetch instead of hardcoded URL
      const res = await api.get('/businesses');
      setBusinesses(res.data);
      
      // Auto-select the first business if available
      if (res.data.length > 0) {
        setSelectedBusiness(res.data[0]);
      }
      setLoading(false);
    } catch (err) {
      console.error("Failed to fetch businesses", err);
      setError("Failed to load business data");
      setLoading(false);
      
      // Redirect to login if unauthorized
      if (err.response && err.response.status === 401) {
        localStorage.removeItem('token');
        navigate('/');
      }
    }
  };

  const fetchApiKeys = async (businessId) => {
    try {
      const res = await api.get(`/keys?businessId=${businessId}`);
      setApiKeys(res.data);
    } catch (err) {
      console.error("Failed to fetch keys", err);
    }
  };

  const createApiKey = async () => {
    if (!selectedBusiness) return;
    try {
      await api.post('/keys', { 
        businessId: selectedBusiness.id,
        name: `Key for ${selectedBusiness.name} - ${new Date().toLocaleDateString()}`
      });
      fetchApiKeys(selectedBusiness.id); // Refresh the list immediately
    } catch (err) {
      alert("Failed to create key");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500 mr-2"></div>
        Loading GlanceID...
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 font-sans">
      {/* SIDEBAR */}
      <aside className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col hidden md:flex">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-indigo-500 tracking-tight">GlanceID</h1>
          <p className="text-xs text-slate-500 mt-1">AI AGENT MARKETPLACE</p>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          <div className="flex items-center px-4 py-3 bg-indigo-600/10 text-indigo-400 rounded-lg cursor-pointer">
            <LayoutDashboard size={20} className="mr-3" />
            <span className="font-medium">Overview</span>
          </div>
          <div className="flex items-center px-4 py-3 text-slate-400 hover:bg-slate-700/50 rounded-lg cursor-pointer transition">
            <CreditCard size={20} className="mr-3" />
            <span className="font-medium">Billing</span>
          </div>
        </nav>

        <div className="p-4 border-t border-slate-700">
          <button onClick={handleLogout} className="flex items-center w-full text-slate-400 hover:text-white transition px-4 py-2 hover:bg-slate-700 rounded-lg">
            <LogOut size={18} className="mr-2" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col overflow-hidden">
        
        {/* HEADER */}
        <header className="bg-slate-800/50 border-b border-slate-700 p-6 flex justify-between items-center backdrop-blur-sm">
          <div>
            <h2 className="text-xl font-semibold text-white">Dashboard</h2>
            <p className="text-slate-400 text-sm">Manage your API keys and usage limits</p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Business Selector */}
            <div className="relative">
              <select 
                className="appearance-none bg-slate-900 border border-slate-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-64 p-2.5 pr-8"
                onChange={(e) => {
                  const bus = businesses.find(b => b.id === parseInt(e.target.value));
                  setSelectedBusiness(bus);
                }}
                value={selectedBusiness?.id || ''}
              >
                {businesses.length === 0 && <option>No Business Found</option>}
                {businesses.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-3 text-slate-400 pointer-events-none" size={16} />
            </div>
          </div>
        </header>

        {/* SCROLLABLE CONTENT */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto space-y-8">
            
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-lg">
                {error}
              </div>
            )}

            {/* STATS CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                <p className="text-slate-400 text-sm font-medium uppercase">Total Requests</p>
                <div className="flex items-baseline mt-2">
                  <h3 className="text-3xl font-bold text-white">0</h3>
                  <span className="ml-2 text-sm text-slate-500">/ 1,000 limit</span>
                </div>
                <p className="text-green-400 text-sm mt-2 flex items-center">
                  <RefreshCw size={14} className="mr-1" /> 0% usage
                </p>
              </div>

              <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                <p className="text-slate-400 text-sm font-medium uppercase">Current Plan</p>
                <h3 className="text-3xl font-bold text-white mt-2">Free Tier</h3>
                <p className="text-slate-500 text-sm mt-2">Upgrade for more limits</p>
              </div>

              <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                <p className="text-slate-400 text-sm font-medium uppercase">Active Keys</p>
                <h3 className="text-3xl font-bold text-white mt-2">{apiKeys.length}</h3>
                <p className="text-indigo-400 text-sm mt-2">Keys are active</p>
              </div>
            </div>

            {/* API KEYS TABLE SECTION */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg overflow-hidden">
              <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold text-white flex items-center">
                    <Key size={20} className="mr-2 text-indigo-500" />
                    API Keys
                  </h3>
                  <p className="text-slate-400 text-sm mt-1">Manage keys for authentication.</p>
                </div>
                <button 
                  onClick={createApiKey}
                  disabled={!selectedBusiness}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center transition"
                >
                  <Plus size={16} className="mr-2" />
                  Create New Key
                </button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase font-medium">
                    <tr>
                      <th className="px-6 py-4">Key Name</th>
                      <th className="px-6 py-4">Key Prefix</th>
                      <th className="px-6 py-4">Created</th>
                      <th className="px-6 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {apiKeys.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="px-6 py-12 text-center text-slate-500">
                          No API keys found. Click "Create New Key" to get started.
                        </td>
                      </tr>
                    ) : (
                      apiKeys.map((key) => (
                        <tr key={key.id} className="hover:bg-slate-700/30 transition">
                          <td className="px-6 py-4 text-white font-medium">
                            {key.name || "Unnamed Key"}
                          </td>
                          <td className="px-6 py-4 text-slate-500 font-mono text-sm">
                            {key.key_hash ? key.key_hash.substring(0, 8) + '...' : '******'}
                          </td>
                          <td className="px-6 py-4 text-slate-400 text-sm">
                            {new Date(key.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4">
                            <span className="bg-green-500/10 text-green-400 px-2 py-1 rounded text-xs font-medium border border-green-500/20">
                              Active
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
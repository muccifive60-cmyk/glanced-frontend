import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { Send, Bot, User, Trash2, Phone, PhoneOff, Camera, Image as ImageIcon, X } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Playground() {
  // --- STATE MANAGEMENT ---
  const [models, setModels] = useState([])
  const [selectedModel, setSelectedModel] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  // --- IMAGE STATE ---
  const [attachedImage, setAttachedImage] = useState(null)
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)

  // --- VOICE STATE ---
  const [isTalking, setIsTalking] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState('Initializing...')
  const [vapiReady, setVapiReady] = useState(false)

  const messagesEndRef = useRef(null)
  const vapiRef = useRef(null)

  // --- KEYS ---
  const VAPI_PUBLIC_KEY = "150fa8ac-12a5-48fb-934f-0a9bbadc2da7"
  const VAPI_ASSISTANT_ID = "be1bcb56-7536-493b-bd99-52e041d8e950"

  // --- INIT ---
  useEffect(() => {
    fetchLibraryModels()
    fetchChatHistory()
    loadVapiScript()

    return () => {
      if (vapiRef.current) vapiRef.current.stop()
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // --- VAPI ENGINE ---
  function loadVapiScript() {
    if (window.Vapi) {
      initializeVapiInstance()
      return
    }

    setVoiceStatus("Downloading Engine...")

    const script = document.createElement("script")
    script.src = "https://cdn.jsdelivr.net/npm/@vapi-ai/web@latest/dist/vapi.min.js"
    script.async = true

    script.onload = () => initializeVapiInstance()
    script.onerror = () => setVoiceStatus("Network Error")

    document.body.appendChild(script)
  }

  function initializeVapiInstance() {
    try {
      const VapiClass = window.Vapi?.default || window.Vapi
      if (!VapiClass) throw new Error("Vapi constructor not found")

      const vapi = new VapiClass(VAPI_PUBLIC_KEY)
      vapiRef.current = vapi

      vapi.on('call-start', () => {
        setIsTalking(true)
        setVoiceStatus('Connected')
      })

      vapi.on('call-end', () => {
        setIsTalking(false)
        setVoiceStatus('Ready')
      })

      vapi.on('error', (e) => {
        console.error(e)
        setIsTalking(false)
        setVoiceStatus('Engine Error')
      })

      setVapiReady(true)
      setVoiceStatus('Ready')
    } catch (err) {
      console.error("VAPI INIT ERROR:", err)
      setVoiceStatus("Engine Error")
    }
  }

  // --- DATABASE ---
  async function fetchLibraryModels() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('user_models')
      .select('ai_models (*)')
      .eq('user_id', user.id)

    if (data) {
      const list = data.map(i => i.ai_models).filter(Boolean)
      setModels(list)
      if (!selectedModel && list.length) setSelectedModel(list[0])
    }
  }

  async function fetchChatHistory() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('chat_history')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (data) setMessages(data)
  }

  // --- IMAGE ---
  const handleImageSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onloadend = () => setAttachedImage(reader.result)
    reader.readAsDataURL(file)
  }

  const removeImage = () => {
    setAttachedImage(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
    if (cameraInputRef.current) cameraInputRef.current.value = ""
  }

  // --- CALL ---
  const toggleCall = async () => {
    if (!vapiReady || !vapiRef.current) return

    if (isTalking) {
      vapiRef.current.stop()
    } else {
      setVoiceStatus('Connecting...')
      try {
        await vapiRef.current.start(VAPI_ASSISTANT_ID)
      } catch {
        setVoiceStatus("Call Failed")
      }
    }
  }

  // --- CHAT ---
  async function handleSend(e) {
    e.preventDefault()
    if ((!input.trim() && !attachedImage) || !selectedModel) return

    const text = input
    const image = attachedImage

    setInput('')
    setAttachedImage(null)
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()

    setMessages(p => [...p, { role: 'user', content: text, image }])

    try {
      const { data, error } = await supabase.functions.invoke('chat-engine', {
        body: { message: text, model_id: selectedModel.id }
      })
      if (error) throw error

      setMessages(p => [...p, { role: 'ai', content: data.reply }])
    } catch {
      setMessages(p => [...p, { role: 'system', content: "Error connecting to AI." }])
    } finally {
      setLoading(false)
    }
  }

  return <div className="text-white"> {/* UI yako inaendelea bila mabadiliko */} </div>
}

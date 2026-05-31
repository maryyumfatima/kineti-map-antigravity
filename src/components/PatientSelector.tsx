import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { Search, ChevronDown, Loader2 } from 'lucide-react'

export type PatientSelectorResult = {
  id: string
  full_name: string | null
  phone_number: string | null
}

interface PatientSelectorProps {
  clinicId: string | null
  selectedPatientId: string | null
  onSelect: (patient: PatientSelectorResult) => void
}

export function PatientSelector({ clinicId, selectedPatientId, onSelect }: PatientSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [patients, setPatients] = useState<PatientSelectorResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedPatientName, setSelectedPatientName] = useState<string | null>(null)
  
  const wrapperRef = useRef<HTMLDivElement>(null)
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Sync selected patient's full name
  useEffect(() => {
    if (!selectedPatientId) {
      setSelectedPatientName(null)
      return
    }
    const found = patients.find(p => p.id === selectedPatientId)
    if (found) {
      setSelectedPatientName(found.full_name)
      return
    }

    if (!clinicId) return

    // If not in the current list, fetch from DB
    const fetchPatientName = async () => {
      try {
        const { data, error } = await supabase
          .from('patients')
          .select('full_name')
          .eq('id', selectedPatientId)
          .eq('clinic_id', clinicId)
          .single()
        if (error) throw error
        if (data?.full_name) {
          setSelectedPatientName(data.full_name)
        }
      } catch (err) {
        console.error('Error fetching patient name:', err)
      }
    }
    fetchPatientName()
  }, [selectedPatientId, patients, clinicId])

  const fetchPatients = async (query: string) => {
    if (!clinicId) return
    setLoading(true)
    try {
      let q = supabase
        .from('patients')
        .select('id, full_name, phone_number, last_booked_at')
        .eq('clinic_id', clinicId)
        .eq('is_deleted', false)

      if (query.trim()) {
        const term = query.trim()
        q = q.or(`full_name.ilike.%${term}%,phone_number.ilike.%${term}%`)
      }

      const { data, error } = await q
        .order('last_booked_at', { ascending: false, nullsFirst: false })
        .limit(50)

      if (error) throw error
      setPatients(data ?? [])
    } catch (err) {
      console.error('Error fetching patients:', err)
      toast.error('Failed to load patients')
    } finally {
      setLoading(false)
    }
  }

  // Load immediately on open or clinicId change
  useEffect(() => {
    if (isOpen && clinicId) {
      fetchPatients(search)
    }
  }, [isOpen, clinicId])

  // Debounced search on query type
  useEffect(() => {
    if (!isOpen || !clinicId) return

    if (!search.trim()) {
      fetchPatients('')
      if (searchDebounce.current) clearTimeout(searchDebounce.current)
      return
    }

    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => {
      fetchPatients(search)
    }, 350)

    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current)
    }
  }, [search])

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 text-left rounded-xl border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all bg-white flex justify-between items-center text-text text-sm shadow-sm hover:border-text/20"
      >
        <span className={selectedPatientName ? 'font-medium text-text' : 'text-text/40'}>
          {selectedPatientName ?? 'Select a patient...'}
        </span>
        <ChevronDown className="w-4 h-4 text-text/40 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden flex flex-col">
          <div className="relative p-2 border-b border-border bg-background/50">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text/30 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search patient..."
              className="w-full pl-8 pr-4 py-2 rounded-lg border border-border bg-background text-text text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-text/30"
              autoFocus
            />
          </div>
          
          <div className="max-h-[260px] overflow-y-auto divide-y divide-border">
            {loading && (
              <div className="p-3 text-center text-xs text-text/50 flex items-center justify-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading patients...
              </div>
            )}
            
            {!loading && patients.length === 0 && (
              <div className="p-3 text-center text-xs text-text/50">No patients found.</div>
            )}
            
            {!loading && patients.map(p => {
              const isSelected = p.id === selectedPatientId
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onSelect(p)
                    setIsOpen(false)
                  }}
                  className={`w-full text-left px-4 py-2.5 transition-colors hover:bg-background/60 flex flex-col ${
                    isSelected ? 'bg-primary/10 text-primary' : 'text-text'
                  }`}
                >
                  <span className="font-semibold text-sm">{p.full_name ?? '—'}</span>
                  {p.phone_number && (
                    <span className="text-xs text-text/50 mt-0.5">{p.phone_number}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

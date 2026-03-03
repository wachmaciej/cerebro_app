"use client"
import { useState, useEffect, useRef } from "react"
import { Calendar, Clock, Play, Pause, Plus, Trash2, ChevronDown, Pencil } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { API_URL } from "@/lib/api"

const CustomSelect = ({ value, onChange, options, placeholder = "Select..." }: any) => {
    const [isOpen, setIsOpen] = useState(false)
    const selectRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const selectedLabel = options.find((opt: any) => opt.value === String(value))?.label || placeholder

    return (
        <div className="relative w-full" ref={selectRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all hover:bg-white/5 group"
            >
                <span className="truncate pr-2">{selectedLabel}</span>
                <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown className="w-4 h-4 text-neutral-500 group-hover:text-white transition-colors" />
                </motion.div>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute top-full left-0 right-0 mt-2 bg-[#0a0a0a] border border-white/20 shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-50 py-2 rounded-xl overflow-hidden"
                    >
                        <div className="max-h-60 overflow-y-auto custom-scrollbar">
                            {options.map((opt: any) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => { onChange(opt.value); setIsOpen(false); }}
                                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-white/[0.05] ${String(value) === String(opt.value) ? "text-indigo-400 bg-indigo-500/10 font-medium" : "text-neutral-300"}`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

const parseCron = (cron: string): string => {
    const parts = cron.trim().split(" ")
    if (parts.length !== 5) return cron
    const [minute, hour, dom, , dow] = parts
    const time = `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`
    if (dom === "*" && dow === "*") return `Daily at ${time}`
    if (dom !== "*" && dow === "*") return `Monthly on day ${dom} at ${time}`
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    if (dow !== "*" && dom === "*") return `Weekly on ${days[parseInt(dow)] ?? dow} at ${time}`
    return cron
}

const parseCronToState = (cron: string) => {
    const parts = cron.trim().split(" ")
    if (parts.length !== 5) return { frequency: "Daily", time: "00:00", dayOfWeek: "1", dayOfMonth: "1" }
    const [minute, hour, dom, , dow] = parts
    const time = `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`
    if (dom !== "*") return { frequency: "Monthly", time, dayOfWeek: "1", dayOfMonth: dom }
    if (dow !== "*") return { frequency: "Weekly", time, dayOfWeek: dow, dayOfMonth: "1" }
    return { frequency: "Daily", time, dayOfWeek: "1", dayOfMonth: "1" }
}

const marketplaceOptions = [
    { value: "US", label: "US - United States" }, { value: "UK", label: "UK - United Kingdom" },
    { value: "CA", label: "CA - Canada" }, { value: "DE", label: "DE - Germany" },
    { value: "FR", label: "FR - France" }, { value: "IT", label: "IT - Italy" },
    { value: "ES", label: "ES - Spain" },
]
const frequencyOptions = [
    { value: "Daily", label: "Daily" }, { value: "Weekly", label: "Weekly" }, { value: "Monthly", label: "Monthly" },
]
const daysOfWeekOptions = [
    { value: "1", label: "Monday" }, { value: "2", label: "Tuesday" }, { value: "3", label: "Wednesday" },
    { value: "4", label: "Thursday" }, { value: "5", label: "Friday" }, { value: "6", label: "Saturday" }, { value: "0", label: "Sunday" },
]
const daysOfMonthOptions = [...Array(31)].map((_, i) => ({ value: String(i + 1), label: String(i + 1) }))

const generateCronExpression = (freq: string, t: string, dow: string, dom: string) => {
    const [hours, minutes] = t.split(":")
    if (freq === "Daily") return `${parseInt(minutes)} ${parseInt(hours)} * * *`
    if (freq === "Weekly") return `${parseInt(minutes)} ${parseInt(hours)} * * ${dow}`
    if (freq === "Monthly") return `${parseInt(minutes)} ${parseInt(hours)} ${dom} * *`
    return "0 0 * * *"
}

const ScheduleFormFields = ({ form, setForm, freq, setFreq, t, setT, dow, setDow, dom, setDom }: any) => (
    <div className="space-y-5">
        <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-400 mb-1.5 font-medium">Schedule Name</label>
            <input
                type="text" required value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                placeholder="e.g. Daily US Sync"
            />
        </div>
        <div className="relative z-50">
            <label className="block text-xs uppercase tracking-wider text-neutral-400 mb-1.5 font-medium">Marketplace</label>
            <CustomSelect value={form.marketplace} onChange={(val: string) => setForm({ ...form, marketplace: val })} options={marketplaceOptions} />
        </div>
        <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] space-y-4">
            <h4 className="text-sm font-medium text-white mb-2">Schedule Timing</h4>
            <div className="grid grid-cols-2 gap-3 relative z-40">
                <div>
                    <label className="block text-xs text-neutral-500 mb-1">Frequency</label>
                    <CustomSelect value={freq} onChange={setFreq} options={frequencyOptions} />
                </div>
                <div>
                    <label className="block text-xs text-neutral-500 mb-1">Time</label>
                    <input type="time" value={t} onChange={e => setT(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 [color-scheme:dark]" />
                </div>
            </div>
            <AnimatePresence mode="wait">
                {freq === "Weekly" && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="relative z-30">
                        <label className="block text-xs text-neutral-500 mb-1 mt-1">Day of Week</label>
                        <CustomSelect value={dow} onChange={setDow} options={daysOfWeekOptions} />
                    </motion.div>
                )}
                {freq === "Monthly" && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="relative z-30">
                        <label className="block text-xs text-neutral-500 mb-1 mt-1">Day of Month</label>
                        <CustomSelect value={dom} onChange={setDom} options={daysOfMonthOptions} />
                    </motion.div>
                )}
            </AnimatePresence>
            <div className="pt-2 text-xs text-neutral-400 bg-white/5 p-2 rounded flex justify-between items-center border border-white/5">
                <span>Generated Cron:</span>
                <span className="font-mono text-indigo-400 font-bold">{generateCronExpression(freq, t, dow, dom)}</span>
            </div>
        </div>
    </div>
)

export default function SchedulesPage() {
    const [schedules, setSchedules] = useState<any[]>([])

    const [isModalOpen, setIsModalOpen] = useState(false)
    const [newSchedule, setNewSchedule] = useState({ name: "", marketplace: "US" })
    const [frequency, setFrequency] = useState("Daily")
    const [time, setTime] = useState("00:00")
    const [dayOfWeek, setDayOfWeek] = useState("1")
    const [dayOfMonth, setDayOfMonth] = useState("1")

    const [editingSchedule, setEditingSchedule] = useState<any | null>(null)
    const [editForm, setEditForm] = useState({ name: "", marketplace: "US" })
    const [editFrequency, setEditFrequency] = useState("Daily")
    const [editTime, setEditTime] = useState("00:00")
    const [editDayOfWeek, setEditDayOfWeek] = useState("1")
    const [editDayOfMonth, setEditDayOfMonth] = useState("1")

    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: number | null }>({ isOpen: false, id: null })

    const fetchSchedules = async () => {
        try {
            const res = await fetch(`${API_URL}/api/schedules/`)
            const data = await res.json()
            setSchedules(data)
        } catch (err) {
            console.error("Failed to fetch schedules:", err)
        }
    }

    useEffect(() => { fetchSchedules() }, [])

    const handleCreateSchedule = async (e: React.FormEvent) => {
        e.preventDefault()
        const cron = generateCronExpression(frequency, time, dayOfWeek, dayOfMonth)
        try {
            const res = await fetch(`${API_URL}/api/schedules/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newSchedule.name, marketplace: newSchedule.marketplace, cron_expression: cron, is_active: true })
            })
            if (res.ok) {
                fetchSchedules()
                setIsModalOpen(false)
                setNewSchedule({ name: "", marketplace: "US" })
                setFrequency("Daily")
                setTime("00:00")
            } else {
                alert("Failed to create schedule")
            }
        } catch (err) {
            console.error("Failed to create schedule", err)
        }
    }

    const openEditModal = (schedule: any) => {
        const parsed = parseCronToState(schedule.cron_expression)
        setEditingSchedule(schedule)
        setEditForm({ name: schedule.name, marketplace: schedule.marketplace })
        setEditFrequency(parsed.frequency)
        setEditTime(parsed.time)
        setEditDayOfWeek(parsed.dayOfWeek)
        setEditDayOfMonth(parsed.dayOfMonth)
    }

    const handleEditSchedule = async (e: React.FormEvent) => {
        e.preventDefault()
        const cron = generateCronExpression(editFrequency, editTime, editDayOfWeek, editDayOfMonth)
        try {
            const res = await fetch(`${API_URL}/api/schedules/${editingSchedule.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: editForm.name, marketplace: editForm.marketplace, cron_expression: cron, is_active: editingSchedule.is_active })
            })
            if (res.ok) {
                fetchSchedules()
                setEditingSchedule(null)
            } else {
                alert("Failed to update schedule")
            }
        } catch (err) {
            console.error("Failed to update schedule", err)
        }
    }

    const toggleSchedule = async (id: number) => {
        try {
            const res = await fetch(`${API_URL}/api/schedules/${id}/toggle`, { method: "PUT" })
            if (res.ok) fetchSchedules()
        } catch (err) {
            console.error("Failed to toggle schedule", err)
        }
    }

    const executeDelete = async () => {
        if (!deleteConfirm.id) return
        try {
            const res = await fetch(`${API_URL}/api/schedules/${deleteConfirm.id}`, { method: "DELETE" })
            if (res.ok) fetchSchedules()
            else alert("Failed to delete schedule")
        } catch (err) {
            console.error("Failed to delete schedule", err)
        } finally {
            setDeleteConfirm({ isOpen: false, id: null })
        }
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 w-full mb-10">
            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {deleteConfirm.isOpen && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setDeleteConfirm({ isOpen: false, id: null })}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                        <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="glass p-6 rounded-2xl border border-white/10 w-full max-w-[400px] relative z-10 shadow-2xl">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="p-3 rounded-full bg-red-500/20 border border-red-500/30">
                                    <Trash2 className="w-6 h-6 text-red-500" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white">Delete Schedule</h3>
                                    <p className="text-neutral-400 text-sm">This action cannot be undone.</p>
                                </div>
                            </div>
                            <p className="text-neutral-300 mb-6">Are you sure you want to delete this schedule? It won't trigger anymore.</p>
                            <div className="flex gap-3">
                                <button onClick={() => setDeleteConfirm({ isOpen: false, id: null })}
                                    className="flex-1 px-4 py-2.5 border border-white/10 hover:bg-white/5 rounded-lg text-sm font-medium text-neutral-300 transition-colors">Cancel</button>
                                <button onClick={executeDelete}
                                    className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 rounded-lg text-sm font-medium text-white transition-colors shadow-[0_0_20px_rgba(239,68,68,0.3)]">Delete</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <header className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-white mb-1">Schedule Tasks</h2>
                    <p className="text-neutral-400 text-sm">Configure automated Helium10 data extractions effortlessly.</p>
                </div>
                <button onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg text-sm font-medium transition-colors shadow-[0_0_15px_rgba(99,102,241,0.4)]">
                    <Plus className="w-4 h-4" /> New Schedule
                </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {schedules.map((schedule) => (
                    <div key={schedule.id} className={`glass p-6 rounded-2xl border transition-all duration-300 relative overflow-hidden group ${schedule.is_active ? 'border-indigo-500/30' : 'border-white/5 opacity-70'}`}>
                        <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br transition-opacity duration-500 rounded-bl-[100px] opacity-20 z-0 ${schedule.is_active ? 'from-indigo-500' : 'from-neutral-500'}`}></div>
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg border ${schedule.is_active ? 'bg-indigo-500/20 border-indigo-500/20' : 'bg-neutral-800 border-neutral-700'}`}>
                                        <Calendar className={`w-5 h-5 ${schedule.is_active ? 'text-indigo-400' : 'text-neutral-500'}`} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white leading-tight">{schedule.name}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${schedule.is_active ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'bg-neutral-800 text-neutral-400 border-neutral-700'}`}>
                                                {schedule.marketplace}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => openEditModal(schedule)}
                                        className="p-1.5 text-neutral-500 hover:text-indigo-400 transition-colors rounded-md hover:bg-indigo-500/10">
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => setDeleteConfirm({ isOpen: true, id: schedule.id })}
                                        className="p-1.5 text-neutral-500 hover:text-red-400 transition-colors rounded-md hover:bg-red-500/10">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="bg-black/40 rounded-xl p-3 mb-2 border border-white/5 font-mono text-xs text-neutral-300 flex items-center justify-between">
                                <span>Cron</span>
                                <span className="text-indigo-300 font-bold tracking-widest">{schedule.cron_expression}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-neutral-400 mb-4 px-1">
                                <Clock className="w-3 h-3 text-neutral-500" />
                                {parseCron(schedule.cron_expression)}
                            </div>

                            <div className="flex items-center justify-between mt-auto">
                                <div className="flex items-center gap-2 text-xs text-neutral-500">
                                    <Clock className="w-3 h-3" />
                                    {new Date(schedule.created_at).toLocaleDateString()}
                                </div>
                                <button onClick={() => toggleSchedule(schedule.id)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${schedule.is_active ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'}`}>
                                    {schedule.is_active ? <><Pause className="w-3 h-3" /> Pause</> : <><Play className="w-3 h-3" /> Resume</>}
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
                {schedules.length === 0 && (
                    <div className="col-span-full text-center py-12 text-neutral-500">
                        No schedules found. Click "New Schedule" to create one.
                    </div>
                )}
            </div>

            {/* Create Schedule Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }}
                            className="bg-[#1C1C1E] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
                            <h3 className="text-xl font-bold text-white mb-6">Create New Schedule</h3>
                            <form onSubmit={handleCreateSchedule} className="space-y-5">
                                <ScheduleFormFields
                                    form={newSchedule} setForm={setNewSchedule}
                                    freq={frequency} setFreq={setFrequency}
                                    t={time} setT={setTime}
                                    dow={dayOfWeek} setDow={setDayOfWeek}
                                    dom={dayOfMonth} setDom={setDayOfMonth}
                                />
                                <div className="flex justify-end gap-3 pt-2">
                                    <button type="button" onClick={() => setIsModalOpen(false)}
                                        className="px-4 py-2 rounded-lg text-sm text-neutral-400 hover:bg-white/5 transition-colors border border-transparent hover:border-white/10">Cancel</button>
                                    <button type="submit"
                                        className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg text-sm font-medium text-white transition-colors shadow-[0_4px_15px_rgba(99,102,241,0.3)]">Create Schedule</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Edit Schedule Modal */}
            <AnimatePresence>
                {editingSchedule && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }}
                            className="bg-[#1C1C1E] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
                            <h3 className="text-xl font-bold text-white mb-6">Edit Schedule</h3>
                            <form onSubmit={handleEditSchedule} className="space-y-5">
                                <ScheduleFormFields
                                    form={editForm} setForm={setEditForm}
                                    freq={editFrequency} setFreq={setEditFrequency}
                                    t={editTime} setT={setEditTime}
                                    dow={editDayOfWeek} setDow={setEditDayOfWeek}
                                    dom={editDayOfMonth} setDom={setEditDayOfMonth}
                                />
                                <div className="flex justify-end gap-3 pt-2">
                                    <button type="button" onClick={() => setEditingSchedule(null)}
                                        className="px-4 py-2 rounded-lg text-sm text-neutral-400 hover:bg-white/5 transition-colors border border-transparent hover:border-white/10">Cancel</button>
                                    <button type="submit"
                                        className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg text-sm font-medium text-white transition-colors shadow-[0_4px_15px_rgba(99,102,241,0.3)]">Save Changes</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}

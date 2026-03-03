"use client"
import { useState, useEffect, useRef } from "react"
import { Search, Plus, Trash2, Edit, Save, Upload, Download, RefreshCw, CheckCircle2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { API_URL } from "@/lib/api"

export default function AsinsPage() {
    const [asins, setAsins] = useState<any[]>([])
    const [searchTerm, setSearchTerm] = useState("")
    const [isUploading, setIsUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Add Single ASIN State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [newAsin, setNewAsin] = useState("")
    const [newMarketplace, setNewMarketplace] = useState("US")
    const [newTags, setNewTags] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Marketplace Filter State
    const [selectedMarket, setSelectedMarket] = useState("All Markets")
    const [isMarketDropdownOpen, setIsMarketDropdownOpen] = useState(false)
    const marketDropdownRef = useRef<HTMLDivElement>(null)
    const [availableMarkets, setAvailableMarkets] = useState<string[]>([])

    // Delete Confirmation State
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: number | null; asin: string | null }>({
        isOpen: false,
        id: null,
        asin: null
    })

    // Toast Notifications State
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null)
    const toastTimerRef = useRef<NodeJS.Timeout | null>(null)

    const showToast = (message: string, type: "success" | "error" = "success") => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
        setToast({ message, type })
        toastTimerRef.current = setTimeout(() => {
            setToast(null)
        }, 5000)
    }

    const fetchAsins = async () => {
        try {
            const queryParams = new URLSearchParams()
            queryParams.append("limit", "50")
            if (selectedMarket !== "All Markets") {
                queryParams.append("marketplace", selectedMarket)
            }
            if (searchTerm.trim() !== "") {
                queryParams.append("search", searchTerm.trim())
            }

            const res = await fetch(`${API_URL}/api/asins/?${queryParams.toString()}`)
            const data = await res.json()
            setAsins(data)
        } catch (err) {
            console.error("Failed to fetch ASINs", err)
        }
    }

    const fetchMarketplaces = async () => {
        try {
            const res = await fetch(`${API_URL}/api/asins/marketplaces`)
            const data = await res.json()
            setAvailableMarkets(data.sort())
        } catch (error) {
            console.error("Error fetching marketplaces:", error)
        }
    }

    const deleteAsin = async (id: number, asinName: string) => {
        setDeleteConfirm({ isOpen: true, id, asin: asinName })
    }

    const executeDelete = async () => {
        if (!deleteConfirm.id) return
        try {
            const res = await fetch(`${API_URL}/api/asins/${deleteConfirm.id}`, {
                method: "DELETE"
            })
            if (res.ok) {
                showToast("ASIN deleted successfully!")
                fetchAsins()
                fetchMarketplaces()
            } else {
                showToast("Failed to delete ASIN", "error")
            }
        } catch (err) {
            console.error("Error deleting ASIN:", err)
            showToast("Error deleting ASIN", "error")
        } finally {
            setDeleteConfirm({ isOpen: false, id: null, asin: null })
        }
    }

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchAsins()
        }, 300) // debounce search slightly
        return () => clearTimeout(timeoutId)
    }, [selectedMarket, searchTerm])

    useEffect(() => {
        fetchMarketplaces()
    }, [])

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsUploading(true)
        const formData = new FormData()
        formData.append("file", file)

        try {
            const res = await fetch(`${API_URL}/api/asins/upload/`, {
                method: "POST",
                body: formData,
            })

            if (res.ok) {
                showToast("CSV uploaded successfully!")
                fetchAsins() // Refresh list
                fetchMarketplaces() // Refresh markets
            } else {
                const err = await res.json()
                showToast(`Upload failed: ${err.detail}`, "error")
            }
        } catch (error) {
            showToast("Error uploading file", "error")
        } finally {
            setIsUploading(false)
            if (fileInputRef.current) {
                fileInputRef.current.value = ""
            }
        }
    }

    const handleAddSingleAsin = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newAsin || !newMarketplace) return

        setIsSubmitting(true)
        try {
            const res = await fetch(`${API_URL}/api/asins/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    asin: newAsin.trim(),
                    marketplace: newMarketplace.trim().toUpperCase(),
                    tags: newTags.trim() || null
                }),
            })

            if (res.ok) {
                showToast("ASIN added successfully!")
                setIsAddModalOpen(false)
                setNewAsin("")
                setNewTags("")
                fetchAsins()
                fetchMarketplaces()
            } else {
                const err = await res.json()
                showToast(err.detail || "Failed to add ASIN", "error")
            }
        } catch (error) {
            showToast("Network error. Please try again.", "error")
        } finally {
            setIsSubmitting(false)
        }
    }

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (marketDropdownRef.current && !marketDropdownRef.current.contains(event.target as Node)) {
                setIsMarketDropdownOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 w-full mb-10">
            <AnimatePresence>
                {deleteConfirm.isOpen && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setDeleteConfirm({ isOpen: false, id: null, asin: null })}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="glass p-6 rounded-2xl border border-white/10 w-full max-w-md relative z-10 shadow-2xl"
                        >
                            <div className="flex items-center gap-4 mb-4">
                                <div className="p-3 rounded-full bg-red-500/20 border border-red-500/30">
                                    <Trash2 className="w-6 h-6 text-red-500" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white">Delete ASIN</h3>
                                    <p className="text-neutral-400 text-sm">This action cannot be undone.</p>
                                </div>
                            </div>

                            <p className="text-neutral-300 mb-6">
                                Are you sure you want to delete <span className="text-white font-mono bg-white/5 px-1.5 py-0.5 rounded italic">{deleteConfirm.asin}</span>?
                            </p>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setDeleteConfirm({ isOpen: false, id: null, asin: null })}
                                    className="flex-1 px-4 py-2.5 border border-white/10 hover:bg-white/5 rounded-lg text-sm font-medium text-neutral-300 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={executeDelete}
                                    className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 rounded-lg text-sm font-medium text-white transition-colors shadow-[0_0_20px_rgba(239,68,68,0.3)]"
                                >
                                    Delete ASIN
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: -20, x: 20 }}
                        animate={{ opacity: 1, y: 0, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={`fixed top-6 right-6 z-[110] px-5 py-3 rounded-xl glass border ${toast.type === "success" ? "border-emerald-500/30" : "border-red-500/30"
                            } shadow-2xl flex items-center gap-3 min-w-[300px]`}
                    >
                        {toast.type === "success" ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        ) : (
                            <Trash2 className="w-5 h-5 text-red-400" />
                        )}
                        <p className="text-sm font-medium text-white">{toast.message}</p>
                        <button
                            onClick={() => setToast(null)}
                            className="ml-auto text-white/40 hover:text-white transition-colors"
                        >
                            <Plus className="w-4 h-4 rotate-45" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isUploading && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="glass p-8 rounded-3xl border border-white/10 flex flex-col items-center max-w-sm w-full shadow-2xl relative overflow-hidden group"
                        >
                            {/* Animated Background Glow */}
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-emerald-500/10 opacity-50 group-hover:opacity-100 transition-opacity duration-1000"></div>

                            {/* Spinning Loader Ring */}
                            <div className="relative mb-6">
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                    className="w-20 h-20 rounded-full border-2 border-transparent border-t-indigo-500 border-r-indigo-500/30"
                                ></motion.div>
                                <motion.div
                                    animate={{ rotate: -360 }}
                                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                    className="absolute inset-2 rounded-full border-2 border-transparent border-b-emerald-500 border-l-emerald-500/30"
                                ></motion.div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <RefreshCw className="w-8 h-8 text-white animate-pulse" />
                                </div>
                            </div>

                            <motion.h3
                                animate={{ opacity: [0.5, 1, 0.5] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="text-xl font-bold text-white mb-2 text-center"
                            >
                                Processing ASINs
                            </motion.h3>
                            <p className="text-neutral-400 text-sm text-center">
                                Analyzing CSV data and synchronizing with your database. This will only take a moment.
                            </p>

                            {/* Progress bar simulation */}
                            <div className="w-full h-1 bg-white/5 rounded-full mt-8 overflow-hidden">
                                <motion.div
                                    initial={{ width: "0%" }}
                                    animate={{ width: "100%" }}
                                    transition={{ duration: 15, ease: "easeInOut" }}
                                    className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500"
                                ></motion.div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-white mb-1">ASIN Management</h2>
                    <p className="text-neutral-400 text-sm">Add or remove ASINs to track across different marketplaces.</p>
                </div>
                <div className="flex items-center gap-3">
                    <a
                        href={`${API_URL}/api/asins/template/`}
                        className="flex items-center gap-2 px-4 py-2 border border-white/10 hover:bg-white/5 rounded-lg text-sm text-neutral-300 font-medium transition-colors"
                        download
                    >
                        <Download className="w-4 h-4" />
                        Template
                    </a>

                    <input
                        type="file"
                        accept=".csv"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors shadow-[0_0_15px_rgba(99,102,241,0.4)]"
                    >
                        <Upload className="w-4 h-4" />
                        {isUploading ? "Uploading..." : "Upload CSV"}
                    </button>

                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 border border-indigo-500/50 hover:bg-indigo-500/10 text-indigo-300 rounded-lg text-sm font-medium transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Add Single
                    </button>
                </div>
            </header>

            {/* Add Single ASIN Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="glass w-full max-w-md rounded-2xl border border-white/10 p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">Add New ASIN</h3>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-neutral-500 hover:text-white transition-colors">
                                <Trash2 className="w-5 h-5 rotate-45" /> {/* Close icon workaround */}
                            </button>
                        </div>

                        <form onSubmit={handleAddSingleAsin} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-neutral-400 mb-1.5 uppercase tracking-wider">ASIN</label>
                                <input
                                    autoFocus
                                    required
                                    type="text"
                                    placeholder="e.g. B08XYZ123"
                                    value={newAsin}
                                    onChange={(e) => setNewAsin(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-neutral-400 mb-1.5 uppercase tracking-wider">Marketplace</label>
                                <select
                                    value={newMarketplace}
                                    onChange={(e) => setNewMarketplace(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none cursor-pointer"
                                >
                                    <option value="US" className="bg-neutral-900">US</option>
                                    <option value="UK" className="bg-neutral-900">UK</option>
                                    <option value="DE" className="bg-neutral-900">DE</option>
                                    <option value="FR" className="bg-neutral-900">FR</option>
                                    <option value="IT" className="bg-neutral-900">IT</option>
                                    <option value="ES" className="bg-neutral-900">ES</option>
                                    <option value="CA" className="bg-neutral-900">CA</option>
                                    <option value="MX" className="bg-neutral-900">MX</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-neutral-400 mb-1.5 uppercase tracking-wider">Tags (Optional)</label>
                                <input
                                    type="text"
                                    placeholder="e.g. seasonal, priority"
                                    value={newTags}
                                    onChange={(e) => setNewTags(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="flex-1 px-4 py-2.5 border border-white/10 hover:bg-white/5 rounded-lg text-sm font-medium text-neutral-300 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors shadow-[0_0_20px_rgba(99,102,241,0.3)]"
                                >
                                    {isSubmitting ? "Adding..." : "Add ASIN"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="glass rounded-2xl border border-white/10">
                <div className="p-4 border-b border-white/10 flex flex-col md:flex-row justify-between gap-4 items-center bg-white/5">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search ASIN or tags..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                        />
                    </div>
                    <div className="flex gap-2 w-full md:w-64 relative" ref={marketDropdownRef}>
                        <button
                            onClick={() => setIsMarketDropdownOpen(!isMarketDropdownOpen)}
                            className="w-full flex justify-between items-center bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all hover:bg-white/5 group"
                        >
                            <span className="flex items-center gap-2">
                                <RefreshCw className={`w-3.5 h-3.5 ${selectedMarket === "All Markets" ? "text-neutral-500" : "text-indigo-400"}`} />
                                {selectedMarket}
                            </span>
                            <motion.div
                                animate={{ rotate: isMarketDropdownOpen ? 180 : 0 }}
                                transition={{ duration: 0.2 }}
                            >
                                <Plus className="w-4 h-4 rotate-45 text-neutral-500 group-hover:text-white transition-colors" />
                            </motion.div>
                        </button>

                        <AnimatePresence>
                            {isMarketDropdownOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    className="absolute top-full right-0 mt-2 w-full bg-[#0a0a0a] border border-white/20 shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-50 py-2 rounded-xl overflow-hidden"
                                >
                                    <button
                                        onClick={() => { setSelectedMarket("All Markets"); setIsMarketDropdownOpen(false); }}
                                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-white/[0.05] ${selectedMarket === "All Markets" ? "text-indigo-400 bg-indigo-500/10 font-medium" : "text-neutral-300"}`}
                                    >
                                        All Markets
                                    </button>
                                    <div className="h-px bg-white/10 my-1.5 mx-3"></div>
                                    <div className="max-h-64 overflow-y-auto custom-scrollbar">
                                        {availableMarkets.length > 0 ? (
                                            availableMarkets.map(market => (
                                                <button
                                                    key={market}
                                                    onClick={() => { setSelectedMarket(market); setIsMarketDropdownOpen(false); }}
                                                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-white/[0.05] ${selectedMarket === market ? "text-indigo-400 bg-indigo-500/10 font-medium" : "text-neutral-300"}`}
                                                >
                                                    {market}
                                                </button>
                                            ))
                                        ) : (
                                            <div className="px-4 py-2 text-xs text-neutral-500 italic">No markets found</div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-neutral-400">
                        <thead className="text-xs uppercase bg-black/40 text-neutral-500 border-b border-white/10">
                            <tr>
                                <th className="px-6 py-4 font-medium">ASIN</th>
                                <th className="px-6 py-4 font-medium">Marketplace</th>
                                <th className="px-6 py-4 font-medium">Tags</th>
                                <th className="px-6 py-4 font-medium">Added</th>
                                <th className="px-6 py-4 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {asins
                                .map((item) => (
                                    <tr key={item.id} className="border-b last:border-0 border-white/5 hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-6 py-4 font-medium text-white">{item.asin}</td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-xs font-medium uppercase">
                                                {item.marketplace}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">{item.tags || '-'}</td>
                                        <td className="px-6 py-4 text-xs">{new Date(item.created_at).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => deleteAsin(item.id, item.asin)}
                                                    className="p-1.5 rounded-md hover:bg-red-500/20 text-neutral-400 hover:text-red-400 transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            {asins.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-neutral-500">
                                        No ASINs found. Try uploading a CSV.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

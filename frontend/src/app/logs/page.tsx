"use client"
import { useState, useEffect, useRef } from "react"
import { CheckCircle2, XCircle, Clock, Loader2, Trash2 } from "lucide-react"
import { API_URL } from "@/lib/api"

export default function LogsPage() {
    const [logs, setLogs] = useState<any[]>([])
    const [statusFilter, setStatusFilter] = useState("All Statuses")
    const [isClearing, setIsClearing] = useState(false)
    const intervalRef = useRef<NodeJS.Timeout | null>(null)

    const fetchLogs = async () => {
        try {
            const res = await fetch(`${API_URL}/api/logs/?limit=100`)
            if (res.ok) {
                const data = await res.json()
                setLogs(data)
            }
        } catch (err) {
            console.error("Failed to fetch logs", err)
        }
    }

    useEffect(() => {
        fetchLogs()
        intervalRef.current = setInterval(fetchLogs, 3000)
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current)
        }
    }, [])

    const filtered = logs.filter(log =>
        statusFilter === "All Statuses" || log.status === statusFilter.toUpperCase()
    )

    const formatDuration = (started: string, completed: string | null) => {
        if (!completed) return "—"
        const ms = new Date(completed).getTime() - new Date(started).getTime()
        const secs = Math.floor(ms / 1000)
        if (secs < 60) return `${secs}s`
        return `${Math.floor(secs / 60)}m ${secs % 60}s`
    }

    const handleClearLogs = async () => {
        setIsClearing(true)
        try {
            await fetch(`${API_URL}/api/logs/`, { method: "DELETE" })
            await fetchLogs()
        } catch (err) {
            console.error("Failed to clear logs", err)
        } finally {
            setIsClearing(false)
        }
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 w-full mb-10">
            <header className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-white mb-1">Execution Logs</h2>
                    <p className="text-neutral-400 text-sm">Track real-time data collection progress and investigate failures.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Auto-refreshing every 3s
                    </div>
                    <button
                        onClick={handleClearLogs}
                        disabled={isClearing || logs.filter(l => l.status !== "QUEUED").length === 0}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs border border-white/10 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-neutral-400 transition-colors"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        {isClearing ? "Clearing..." : "Clear Logs"}
                    </button>
                </div>
            </header>

            <div className="glass rounded-2xl border border-white/10 overflow-hidden flex flex-col h-[calc(100vh-12rem)] min-h-[500px]">
                {/* Toolbar */}
                <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5 shrink-0">
                    <p className="text-sm text-neutral-400">{filtered.length} log{filtered.length !== 1 ? "s" : ""}</p>
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none min-w-[140px]"
                    >
                        <option>All Statuses</option>
                        <option>Queued</option>
                        <option>Success</option>
                        <option>Failed</option>
                    </select>
                </div>

                {/* Log Table */}
                <div className="flex-1 overflow-x-auto relative">
                    <table className="w-full text-left text-sm text-neutral-400 border-separate border-spacing-0">
                        <thead className="text-xs uppercase bg-black/40 text-neutral-500 sticky top-0 z-10 backdrop-blur-md">
                            <tr>
                                <th className="px-6 py-4 font-medium border-b border-white/10">Run ID</th>
                                <th className="px-6 py-4 font-medium border-b border-white/10">Marketplace</th>
                                <th className="px-6 py-4 font-medium border-b border-white/10">Status</th>
                                <th className="px-6 py-4 font-medium border-b border-white/10">Started At</th>
                                <th className="px-6 py-4 font-medium border-b border-white/10">Duration</th>
                                <th className="px-6 py-4 font-medium border-b border-white/10">Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((log) => (
                                <tr key={log.id} className="border-b last:border-0 border-white/5 hover:bg-white/[0.02] transition-colors group">
                                    <td className="px-6 py-4 font-mono text-xs text-neutral-500 group-hover:text-indigo-400 transition-colors border-b border-white/5">
                                        #{log.id}
                                    </td>
                                    <td className="px-6 py-4 border-b border-white/5">
                                        <span className="px-2 py-1 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-xs font-medium uppercase">
                                            {log.marketplace}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 border-b border-white/5">
                                        {log.status === "SUCCESS" && (
                                            <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded inline-flex text-xs border border-emerald-500/20">
                                                <CheckCircle2 className="w-3.5 h-3.5" /> Success
                                            </div>
                                        )}
                                        {log.status === "FAILED" && (
                                            <div className="flex items-center gap-1.5 text-rose-400 bg-rose-500/10 px-2 py-1 rounded inline-flex text-xs border border-rose-500/20">
                                                <XCircle className="w-3.5 h-3.5" /> Failed
                                            </div>
                                        )}
                                        {log.status === "QUEUED" && (
                                            <div className="flex items-center gap-1.5 text-amber-400 bg-amber-500/10 px-2 py-1 rounded inline-flex text-xs border border-amber-500/20">
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing...
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 border-b border-white/5">
                                        <div className="flex items-center gap-1.5 text-xs">
                                            <Clock className="w-3.5 h-3.5 text-neutral-500" />
                                            {new Date(log.started_at).toLocaleString()}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-xs font-mono border-b border-white/5">
                                        {formatDuration(log.started_at, log.completed_at)}
                                    </td>
                                    <td className="px-6 py-4 border-b border-white/5 max-w-xs">
                                        {log.log_output && (
                                            <p className="text-xs text-neutral-300 truncate" title={log.log_output}>
                                                {log.log_output}
                                            </p>
                                        )}
                                        {log.error_message && (
                                            <p className="text-xs text-rose-400 truncate" title={log.error_message}>
                                                {log.error_message}
                                            </p>
                                        )}
                                        {log.status === "QUEUED" && !log.log_output && (
                                            <p className="text-xs text-amber-400/70 italic">Fetching data from Helium10...</p>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-neutral-500">
                                        No logs found.
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

"use client"
import { useState, useEffect } from "react"
import { Save, Key, Wallet, Loader2, CheckCircle2, XCircle } from "lucide-react"
import { API_URL } from "@/lib/api"

export default function SettingsPage() {
    const [token, setToken] = useState("")
    const [isSaving, setIsSaving] = useState(false)
    const [message, setMessage] = useState("")

    const [balance, setBalance] = useState<number | null>(null)
    const [isCheckingBalance, setIsCheckingBalance] = useState(false)
    const [balanceError, setBalanceError] = useState("")

    useEffect(() => {
        fetch(`${API_URL}/api/settings/helium10_api_token`)
            .then(res => res.json())
            .then(data => { if (data.value) setToken(data.value) })
            .catch(err => console.error("Error fetching setting:", err))
    }, [])

    const handleSave = async () => {
        setIsSaving(true)
        setMessage("")
        try {
            const res = await fetch(`${API_URL}/api/settings/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key: "helium10_api_token", value: token })
            })
            setMessage(res.ok ? "Token saved successfully!" : "Failed to save token.")
        } catch {
            setMessage("Error saving token.")
        } finally {
            setIsSaving(false)
        }
    }

    const handleCheckBalance = async () => {
        setIsCheckingBalance(true)
        setBalance(null)
        setBalanceError("")
        try {
            const res = await fetch(`${API_URL}/api/balance`)
            if (!res.ok) {
                const err = await res.json()
                setBalanceError(err.detail ?? "Failed to fetch balance.")
            } else {
                const data = await res.json()
                setBalance(data.balance ?? data.credits ?? 0)
            }
        } catch {
            setBalanceError("Could not connect to server.")
        } finally {
            setIsCheckingBalance(false)
        }
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 w-full mb-10">
            <header className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-white mb-1">Settings</h2>
                    <p className="text-neutral-400 text-sm">Configure application settings and API tokens.</p>
                </div>
            </header>

            {/* API Token card */}
            <div className="glass rounded-2xl border border-white/10 overflow-hidden p-6 max-w-2xl">
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-neutral-300 mb-2 flex items-center gap-2">
                            <Key className="w-4 h-4 text-indigo-400" />
                            Helium10 Cerebro API Token
                        </label>
                        <p className="text-xs text-neutral-500 mb-4">
                            You can find this token in your Helium10 Account {">"} API Settings.
                            It is used to fetch data from Cerebro via the background worker.
                        </p>
                        <input
                            type="password"
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-mono"
                            placeholder="Paste your Bearer token here..."
                        />
                    </div>

                    <div className="pt-4 flex items-center justify-between border-t border-white/10">
                        <span className={`text-sm ${message.includes("success") ? "text-green-400" : "text-red-400"}`}>
                            {message}
                        </span>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-2 px-6 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors shadow-[0_0_15px_rgba(99,102,241,0.4)]"
                        >
                            <Save className="w-4 h-4" />
                            {isSaving ? "Saving..." : "Save Token"}
                        </button>
                    </div>
                </div>
            </div>

            {/* Balance card */}
            <div className="glass rounded-2xl border border-white/10 overflow-hidden p-6 max-w-2xl">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h3 className="text-sm font-medium text-neutral-300 flex items-center gap-2 mb-1">
                            <Wallet className="w-4 h-4 text-indigo-400" />
                            Cerebro API Balance
                        </h3>
                        <p className="text-xs text-neutral-500">
                            Check your remaining Helium10 Cerebro API credits.
                        </p>
                    </div>
                    <button
                        onClick={handleCheckBalance}
                        disabled={isCheckingBalance || !token}
                        className="shrink-0 flex items-center gap-2 px-4 py-2 border border-white/10 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm text-neutral-300 transition-colors"
                    >
                        {isCheckingBalance
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Checking...</>
                            : "Check Balance"
                        }
                    </button>
                </div>

                {(balance !== null || balanceError) && (
                    <div className={`mt-4 p-4 rounded-xl border flex items-center gap-3 ${
                        balanceError
                            ? "border-red-500/20 bg-red-500/5"
                            : "border-green-500/20 bg-green-500/5"
                    }`}>
                        {balanceError ? (
                            <>
                                <XCircle className="w-5 h-5 text-red-400 shrink-0" />
                                <span className="text-sm text-red-400">{balanceError}</span>
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                                <div>
                                    <p className="text-xs text-neutral-500 mb-0.5">Available Credits</p>
                                    <p className="text-2xl font-bold text-white tabular-nums">
                                        {typeof balance === "number" ? balance.toLocaleString() : balance}
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

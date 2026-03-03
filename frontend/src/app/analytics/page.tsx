"use client"
import { useState } from "react"
import { Search, TrendingUp, BarChart2 } from "lucide-react"
import { API_URL } from "@/lib/api"
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts"

const MARKETPLACES = [
    { value: "US", label: "US - United States" },
    { value: "UK", label: "UK - United Kingdom" },
    { value: "CA", label: "CA - Canada" },
    { value: "DE", label: "DE - Germany" },
    { value: "FR", label: "FR - France" },
    { value: "IT", label: "IT - Italy" },
    { value: "ES", label: "ES - Spain" },
]

type Keyword = { keyword: string; search_volume: number }
type TrendPoint = { month: string; search_volume: number; organic_rank: number }

export default function AnalyticsPage() {
    const [marketplace, setMarketplace] = useState("US")
    const [asin, setAsin] = useState("")
    const [keywords, setKeywords] = useState<Keyword[]>([])
    const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null)
    const [trendData, setTrendData] = useState<TrendPoint[]>([])
    const [loadingKeywords, setLoadingKeywords] = useState(false)
    const [loadingTrend, setLoadingTrend] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [searchedAsin, setSearchedAsin] = useState<string | null>(null)

    const handleSearch = async () => {
        if (!asin.trim()) return
        setLoadingKeywords(true)
        setError(null)
        setKeywords([])
        setSelectedKeyword(null)
        setTrendData([])
        try {
            const res = await fetch(
                `${API_URL}/api/bigquery/keywords?asin=${asin.trim().toUpperCase()}&marketplace=${marketplace}`
            )
            if (!res.ok) throw new Error(await res.text())
            const data = await res.json()
            if (data.length === 0) setError("No keywords found for this ASIN in the selected marketplace.")
            setKeywords(data)
            setSearchedAsin(asin.trim().toUpperCase())
        } catch (e: any) {
            setError(e.message || "Failed to fetch keywords.")
        } finally {
            setLoadingKeywords(false)
        }
    }

    const handleKeywordSelect = async (kw: string) => {
        if (!searchedAsin) return
        setSelectedKeyword(kw)
        setLoadingTrend(true)
        setTrendData([])
        try {
            const res = await fetch(
                `${API_URL}/api/bigquery/keyword-trend?asin=${searchedAsin}&marketplace=${marketplace}&keyword=${encodeURIComponent(kw)}`
            )
            if (!res.ok) throw new Error(await res.text())
            setTrendData(await res.json())
        } catch (e: any) {
            setError(e.message || "Failed to fetch trend data.")
        } finally {
            setLoadingTrend(false)
        }
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 w-full mb-10">
            <header>
                <h2 className="text-3xl font-bold tracking-tight text-white mb-1">Keyword Analytics</h2>
                <p className="text-neutral-400 text-sm">Explore keyword trends for any ASIN from BigQuery data.</p>
            </header>

            {/* Search Bar */}
            <div className="glass p-6 rounded-2xl border border-white/10">
                <div className="flex flex-col sm:flex-row gap-3">
                    <select
                        value={marketplace}
                        onChange={e => setMarketplace(e.target.value)}
                        className="bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 sm:w-52"
                    >
                        {MARKETPLACES.map(m => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                    </select>
                    <input
                        type="text"
                        value={asin}
                        onChange={e => setAsin(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleSearch()}
                        placeholder="Enter ASIN (e.g. B08XYZ1234)"
                        className="flex-1 bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                    <button
                        onClick={handleSearch}
                        disabled={loadingKeywords || !asin.trim()}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors shadow-[0_0_15px_rgba(99,102,241,0.4)]"
                    >
                        <Search className="w-4 h-4" />
                        {loadingKeywords ? "Searching..." : "Search"}
                    </button>
                </div>
            </div>

            {error && (
                <div className="glass p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
                    {error}
                </div>
            )}

            {keywords.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Keywords List */}
                    <div className="glass p-5 rounded-2xl border border-white/10 lg:col-span-1 min-w-0">
                        <div className="flex items-center gap-2 mb-4">
                            <BarChart2 className="w-4 h-4 text-indigo-400" />
                            <h3 className="text-sm font-semibold text-white">
                                Keywords <span className="text-neutral-500 font-normal">({keywords.length})</span>
                            </h3>
                        </div>
                        <div className="space-y-1 max-h-[520px] overflow-y-auto pr-1 custom-scrollbar">
                            {keywords.map(kw => (
                                <button
                                    key={kw.keyword}
                                    onClick={() => handleKeywordSelect(kw.keyword)}
                                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex justify-between items-center gap-2 ${
                                        selectedKeyword === kw.keyword
                                            ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                                            : "text-neutral-300 hover:bg-white/5 border border-transparent"
                                    }`}
                                >
                                    <span className="truncate">{kw.keyword}</span>
                                    <span className="text-xs text-neutral-500 shrink-0">
                                        {kw.search_volume?.toLocaleString()}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Chart */}
                    <div className="glass p-6 rounded-2xl border border-white/10 lg:col-span-3">
                        {!selectedKeyword && (
                            <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-neutral-500">
                                <TrendingUp className="w-10 h-10 mb-3 opacity-30" />
                                <p className="text-sm">Select a keyword to see the trend</p>
                            </div>
                        )}
                        {selectedKeyword && (
                            <>
                                <div className="mb-5">
                                    <h3 className="text-base font-semibold text-white">{selectedKeyword}</h3>
                                    <p className="text-xs text-neutral-500 mt-0.5">{searchedAsin} · {marketplace}</p>
                                </div>

                                {loadingTrend && (
                                    <div className="h-72 flex items-center justify-center text-neutral-500 text-sm">
                                        Loading trend data...
                                    </div>
                                )}

                                {!loadingTrend && trendData.length === 0 && (
                                    <div className="h-72 flex items-center justify-center text-neutral-500 text-sm">
                                        No trend data available for this keyword.
                                    </div>
                                )}

                                {!loadingTrend && trendData.length > 0 && (
                                    <div className="space-y-6">
                                        {/* Search Volume Chart */}
                                        <div>
                                            <p className="text-xs text-neutral-400 mb-2 uppercase tracking-wider">Search Volume</p>
                                            <ResponsiveContainer width="100%" height={200}>
                                                <LineChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                                    <XAxis dataKey="month" tick={{ fill: "#737373", fontSize: 11 }} axisLine={false} tickLine={false} />
                                                    <YAxis tick={{ fill: "#737373", fontSize: 11 }} axisLine={false} tickLine={false} width={55} />
                                                    <Tooltip
                                                        contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "12px" }}
                                                        labelStyle={{ color: "#a3a3a3" }}
                                                        itemStyle={{ color: "#818cf8" }}
                                                    />
                                                    <Line type="monotone" dataKey="search_volume" stroke="#818cf8" strokeWidth={2} dot={{ r: 3, fill: "#818cf8" }} name="Search Volume" />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>

                                        {/* Organic Rank Chart */}
                                        <div>
                                            <p className="text-xs text-neutral-400 mb-2 uppercase tracking-wider">Organic Rank</p>
                                            <ResponsiveContainer width="100%" height={200}>
                                                <LineChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                                    <XAxis dataKey="month" tick={{ fill: "#737373", fontSize: 11 }} axisLine={false} tickLine={false} />
                                                    <YAxis tick={{ fill: "#737373", fontSize: 11 }} axisLine={false} tickLine={false} width={40} reversed />
                                                    <Tooltip
                                                        contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "12px" }}
                                                        labelStyle={{ color: "#a3a3a3" }}
                                                        itemStyle={{ color: "#34d399" }}
                                                    />
                                                    <Line type="monotone" dataKey="organic_rank" stroke="#34d399" strokeWidth={2} dot={{ r: 3, fill: "#34d399" }} name="Organic Rank" />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

"use client"
/**
 * Analytics Overview dashboard — keyword performance, marketplace breakdown,
 * sync history, and recent activity. Uses framer-motion for entrance animations
 * and recharts AreaChart with SVG gradient fills for a premium chart look.
 */
import { BarChart3, TrendingUp, Zap, Clock, CalendarDays, CheckCircle2, XCircle, Loader2, Activity } from "lucide-react"
import { useState, useEffect } from "react"
import { API_URL } from "@/lib/api"
import { motion, AnimatePresence } from "framer-motion"
import {
    AreaChart, Area, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer,
} from "recharts"

type MarketBreakdown = { marketplace: string; count: number }
type MarketStat = { marketplace: string; month: string; avg_search_volume: number; avg_organic_rank: number }

const MARKET_COLORS: Record<string, string> = {
    US: "#34d399", UK: "#fbbf24", CA: "#f87171",
    DE: "#22d3ee", IT: "#818cf8", ES: "#a78bfa", FR: "#fb923c",
}

const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.45, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] } }),
}

const ChartTooltip = ({ active, payload, label, valueFormatter }: any) => {
    if (!active || !payload?.length) return null
    return (
        <div className="bg-[#08080f]/95 border border-white/10 rounded-2xl px-4 py-3 shadow-2xl backdrop-blur-xl min-w-[140px]">
            <p className="text-xs text-neutral-500 mb-2.5 font-medium tracking-wide uppercase">{label}</p>
            {payload.map((p: any, i: number) => (
                <div key={i} className="flex items-center justify-between gap-4 text-xs mb-1 last:mb-0">
                    <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color, boxShadow: `0 0 6px ${p.color}` }} />
                        <span className="text-neutral-400">{p.name}</span>
                    </span>
                    <span className="text-white font-semibold tabular-nums">
                        {valueFormatter ? valueFormatter(p.value, p.name) : p.value}
                    </span>
                </div>
            ))}
        </div>
    )
}

export default function Home() {
    const [stats, setStats] = useState({
        total_asins: 0, total_syncs: 0, success_rate: 0,
        next_sync: "calculating...", next_sync_in: "calculating...", markets_count: 0,
    })
    const [breakdown, setBreakdown] = useState<MarketBreakdown[]>([])
    const [syncHistory, setSyncHistory] = useState<{ date: string; success: number; failed: number }[]>([])
    const [recentLogs, setRecentLogs] = useState<any[]>([])
    const [marketStats, setMarketStats] = useState<any[]>([])
    const [marketplaces, setMarketplaces] = useState<string[]>([])
    const [selectedMarkets, setSelectedMarkets] = useState<string[]>(["US"])

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const [statsRes, breakdownRes, logsRes, marketStatsRes] = await Promise.all([
                    fetch(`${API_URL}/api/dashboard/stats`),
                    fetch(`${API_URL}/api/dashboard/marketplace-breakdown`),
                    fetch(`${API_URL}/api/logs/?limit=100`),
                    fetch(`${API_URL}/api/bigquery/market-overview`),
                ])
                if (statsRes.ok) setStats(await statsRes.json())
                if (breakdownRes.ok) setBreakdown(await breakdownRes.json())
                if (logsRes.ok) {
                    const logs = await logsRes.json()
                    setRecentLogs(logs.slice(0, 5))
                    setSyncHistory(buildSyncHistory(logs))
                }
                if (marketStatsRes.ok) {
                    const raw: MarketStat[] = await marketStatsRes.json()
                    const mkts = [...new Set(raw.map(d => d.marketplace))]
                    setMarketplaces(mkts)
                    const byMonth: Record<string, any> = {}
                    raw.forEach(d => {
                        if (!byMonth[d.month]) byMonth[d.month] = { month: d.month }
                        byMonth[d.month][`${d.marketplace}_sv`] = d.avg_search_volume
                        byMonth[d.month][`${d.marketplace}_rank`] = d.avg_organic_rank
                    })
                    setMarketStats(Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month)))
                }
            } catch (e) { console.error("Dashboard fetch error", e) }
        }
        fetchAll()
    }, [])

    const buildSyncHistory = (logs: any[]) => {
        const byDay: Record<string, { date: string; success: number; failed: number }> = {}
        logs.filter(l => l.status !== "QUEUED").forEach(log => {
            const date = new Date(log.started_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
            if (!byDay[date]) byDay[date] = { date, success: 0, failed: 0 }
            if (log.status === "SUCCESS") byDay[date].success++
            else byDay[date].failed++
        })
        return Object.values(byDay).slice(-10)
    }

    const maxCount = breakdown.length > 0 ? Math.max(...breakdown.map(b => b.count)) : 1

    const statCards = [
        {
            label: "ASINs Tracked", value: stats.total_asins.toLocaleString(),
            sub: `Across ${stats.markets_count} markets`, color: "#818cf8",
            icon: <BarChart3 className="w-5 h-5" />, gradient: "from-indigo-500/20 via-indigo-500/5 to-transparent",
        },
        {
            label: "Total Syncs", value: stats.total_syncs.toLocaleString(),
            sub: `${stats.success_rate}% success rate`, color: "#34d399",
            icon: <Zap className="w-5 h-5" />, gradient: "from-emerald-500/20 via-emerald-500/5 to-transparent",
        },
        {
            label: "Next Scheduled", value: stats.next_sync, isSmall: true,
            sub: stats.next_sync_in, color: "#fbbf24",
            icon: <Clock className="w-5 h-5" />, gradient: "from-amber-500/20 via-amber-500/5 to-transparent",
        },
    ]

    return (
        <div className="space-y-6 w-full mb-10">
            <motion.header
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="flex justify-between items-end"
            >
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-white mb-1">Analytics Overview</h2>
                    <p className="text-neutral-400 text-sm">Monitor your Helium10 data collection progress and keyword trends.</p>
                </div>
            </motion.header>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {statCards.map((card, i) => (
                    <motion.div
                        key={card.label}
                        custom={i}
                        variants={fadeUp}
                        initial="hidden"
                        animate="visible"
                        whileHover={{ y: -3, transition: { duration: 0.2 } }}
                        className="glass rounded-2xl border border-white/10 p-6 relative overflow-hidden group cursor-default"
                    >
                        {/* Gradient bg on hover */}
                        <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                        {/* Ambient glow */}
                        <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full blur-3xl opacity-0 group-hover:opacity-30 transition-opacity duration-700"
                            style={{ background: card.color }} />
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-5">
                                <p className="text-neutral-400 text-xs font-semibold uppercase tracking-widest">{card.label}</p>
                                <div className="p-2 rounded-xl border transition-all duration-300 group-hover:scale-110"
                                    style={{ background: `${card.color}18`, borderColor: `${card.color}30`, color: card.color }}>
                                    {card.icon}
                                </div>
                            </div>
                            <h3 className={`font-bold text-white mb-2 ${card.isSmall ? "text-xl leading-tight" : "text-4xl tabular-nums"}`}>
                                {card.value}
                            </h3>
                            <p className="text-xs flex items-center gap-1" style={{ color: card.color }}>
                                <TrendingUp className="w-3 h-3" /> {card.sub}
                            </p>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Marketplace Coverage + Sync History */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* Marketplace Coverage */}
                <motion.div
                    custom={3} variants={fadeUp} initial="hidden" animate="visible"
                    className="glass rounded-2xl border border-white/10 p-6 relative overflow-hidden"
                >
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />
                    <div className="flex items-center gap-2 mb-6">
                        <div className="p-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/20">
                            <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
                        </div>
                        <h3 className="text-sm font-semibold text-white">Marketplace Coverage</h3>
                        <span className="ml-auto text-xs text-neutral-500 bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                            {stats.total_asins.toLocaleString()} ASINs
                        </span>
                    </div>
                    {breakdown.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 gap-3">
                            <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
                                <BarChart3 className="w-6 h-6 text-neutral-600" />
                            </div>
                            <p className="text-sm text-neutral-600">No ASINs tracked yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {breakdown.map((b, i) => {
                                const pct = (b.count / maxCount) * 100
                                const color = MARKET_COLORS[b.marketplace] ?? "#94a3b8"
                                return (
                                    <motion.div key={b.marketplace}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.3 + i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                                    >
                                        <div className="flex justify-between items-center mb-1.5">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color, boxShadow: `0 0 6px ${color}80` }} />
                                                <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">{b.marketplace}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-neutral-500 tabular-nums">{b.count.toLocaleString()}</span>
                                                <span className="text-xs font-medium tabular-nums" style={{ color }}>{pct.toFixed(0)}%</span>
                                            </div>
                                        </div>
                                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                            <motion.div
                                                className="h-full rounded-full"
                                                initial={{ width: 0 }}
                                                animate={{ width: `${pct}%` }}
                                                transition={{ delay: 0.4 + i * 0.06, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                                                style={{ background: `linear-gradient(90deg, ${color}90, ${color})`, boxShadow: `0 0 8px ${color}50` }}
                                            />
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </div>
                    )}
                </motion.div>

                {/* Sync History */}
                <motion.div
                    custom={4} variants={fadeUp} initial="hidden" animate="visible"
                    className="glass rounded-2xl border border-white/10 p-6 relative overflow-hidden"
                >
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
                    <div className="flex items-center gap-2 mb-6">
                        <div className="p-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/20">
                            <Activity className="w-3.5 h-3.5 text-emerald-400" />
                        </div>
                        <h3 className="text-sm font-semibold text-white">Sync History</h3>
                        <span className="ml-auto text-xs text-neutral-500 bg-white/5 px-2 py-0.5 rounded-full border border-white/5">Last 10 days</span>
                    </div>
                    {syncHistory.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 gap-3">
                            <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
                                <Activity className="w-6 h-6 text-neutral-600" />
                            </div>
                            <p className="text-sm text-neutral-600">No sync history yet.</p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={syncHistory} margin={{ top: 5, right: 5, left: -20, bottom: 5 }} barSize={14} barGap={2}>
                                <defs>
                                    <linearGradient id="gradSuccess" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#34d399" stopOpacity={0.9} />
                                        <stop offset="100%" stopColor="#34d399" stopOpacity={0.4} />
                                    </linearGradient>
                                    <linearGradient id="gradFailed" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#f87171" stopOpacity={0.9} />
                                        <stop offset="100%" stopColor="#f87171" stopOpacity={0.4} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                                <XAxis dataKey="date" tick={{ fill: "#525252", fontSize: 10 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: "#525252", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                                <Tooltip
                                    content={<ChartTooltip valueFormatter={(v: number) => v} />}
                                    cursor={{ fill: "rgba(255,255,255,0.03)", radius: 4 }}
                                />
                                <Bar dataKey="success" name="Success" fill="url(#gradSuccess)" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="failed" name="Failed" fill="url(#gradFailed)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </motion.div>
            </div>

            {/* Keyword Performance Charts */}
            {marketStats.length > 0 && (
                <motion.div
                    custom={5} variants={fadeUp} initial="hidden" animate="visible"
                    className="glass rounded-2xl border border-white/10 relative overflow-hidden"
                >
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/40 to-transparent" />
                    {/* Ambient radial glow */}
                    <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full blur-[80px] bg-indigo-500/10 pointer-events-none" />

                    <div className="p-6 pb-4">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                            <div className="flex items-center gap-2.5">
                                <div className="p-1.5 rounded-lg bg-purple-500/15 border border-purple-500/20">
                                    <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-white">Keyword Performance by Market</h3>
                                    <p className="text-xs text-neutral-600 mt-0.5">Top 100 keywords by search volume</p>
                                </div>
                            </div>
                            {/* Market toggle chips */}
                            <div className="flex flex-wrap gap-2 sm:ml-auto">
                                {marketplaces.map(m => {
                                    const active = selectedMarkets.includes(m)
                                    const color = MARKET_COLORS[m] ?? "#94a3b8"
                                    return (
                                        <motion.button
                                            key={m}
                                            onClick={() => setSelectedMarkets(prev =>
                                                active ? prev.filter(x => x !== m) : [...prev, m]
                                            )}
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            className="relative px-3 py-1 rounded-full text-xs font-semibold border transition-all duration-250 overflow-hidden"
                                            style={{
                                                borderColor: active ? `${color}60` : "rgba(255,255,255,0.08)",
                                                background: active ? `${color}18` : "transparent",
                                                color: active ? color : "#525252",
                                                boxShadow: active ? `0 0 12px ${color}25` : "none",
                                            }}
                                        >
                                            <span className="flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full transition-all duration-200"
                                                    style={{ background: active ? color : "#404040", boxShadow: active ? `0 0 4px ${color}` : "none" }} />
                                                {m}
                                            </span>
                                        </motion.button>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-white/5">
                        {/* Avg Search Volume */}
                        <div className="p-6 pt-2">
                            <p className="text-xs text-neutral-500 font-semibold uppercase tracking-widest mb-5">Avg Search Volume</p>
                            <ResponsiveContainer width="100%" height={280}>
                                <AreaChart data={marketStats} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        {Object.entries(MARKET_COLORS).map(([m, color]) => (
                                            <linearGradient key={m} id={`sv_${m}`} x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                                                <stop offset="95%" stopColor={color} stopOpacity={0} />
                                            </linearGradient>
                                        ))}
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                                    <XAxis dataKey="month" tick={{ fill: "#404040", fontSize: 11 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fill: "#404040", fontSize: 11 }} axisLine={false} tickLine={false} width={55}
                                        tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                                    <Tooltip
                                        content={<ChartTooltip valueFormatter={(v: number) => Number(v).toLocaleString()} />}
                                        cursor={{ stroke: "rgba(255,255,255,0.06)", strokeWidth: 1 }}
                                    />
                                    {selectedMarkets.map(m => (
                                        <Area key={m} type="monotone" dataKey={`${m}_sv`} name={m}
                                            stroke={MARKET_COLORS[m] ?? "#94a3b8"}
                                            strokeWidth={2.5}
                                            fill={`url(#sv_${m})`}
                                            dot={false}
                                            activeDot={{ r: 5, fill: MARKET_COLORS[m], stroke: "rgba(0,0,0,0.5)", strokeWidth: 2 }}
                                            connectNulls
                                        />
                                    ))}
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Avg Organic Rank */}
                        <div className="p-6 pt-2">
                            <p className="text-xs text-neutral-500 font-semibold uppercase tracking-widest mb-5">Avg Organic Rank <span className="normal-case font-normal text-neutral-600">(lower = better)</span></p>
                            <ResponsiveContainer width="100%" height={280}>
                                <AreaChart data={marketStats} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        {Object.entries(MARKET_COLORS).map(([m, color]) => (
                                            <linearGradient key={m} id={`rank_${m}`} x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                                                <stop offset="95%" stopColor={color} stopOpacity={0} />
                                            </linearGradient>
                                        ))}
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                                    <XAxis dataKey="month" tick={{ fill: "#404040", fontSize: 11 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fill: "#404040", fontSize: 11 }} axisLine={false} tickLine={false} width={40} reversed />
                                    <Tooltip
                                        content={<ChartTooltip valueFormatter={(v: number) => `#${v}`} />}
                                        cursor={{ stroke: "rgba(255,255,255,0.06)", strokeWidth: 1 }}
                                    />
                                    {selectedMarkets.map(m => (
                                        <Area key={m} type="monotone" dataKey={`${m}_rank`} name={m}
                                            stroke={MARKET_COLORS[m] ?? "#94a3b8"}
                                            strokeWidth={2.5}
                                            fill={`url(#rank_${m})`}
                                            dot={false}
                                            activeDot={{ r: 5, fill: MARKET_COLORS[m], stroke: "rgba(0,0,0,0.5)", strokeWidth: 2 }}
                                            connectNulls
                                        />
                                    ))}
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Recent Activity */}
            <motion.div
                custom={6} variants={fadeUp} initial="hidden" animate="visible"
                className="glass rounded-2xl border border-white/10 overflow-hidden"
            >
                <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-2.5 bg-white/[0.02]">
                    <div className="p-1.5 rounded-lg bg-white/5 border border-white/8">
                        <Clock className="w-3.5 h-3.5 text-neutral-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-white">Recent Activity</h3>
                    <span className="ml-auto text-xs text-neutral-600">{recentLogs.length} entries</span>
                </div>
                {recentLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                        <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
                            <Activity className="w-6 h-6 text-neutral-600" />
                        </div>
                        <p className="text-sm text-neutral-600">No activity yet.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-white/[0.04]">
                        {recentLogs.map((log, i) => (
                            <motion.div
                                key={log.id}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.5 + i * 0.06, duration: 0.35 }}
                                className="px-6 py-3.5 flex items-center gap-4 hover:bg-white/[0.025] transition-colors duration-200 group"
                            >
                                <span className="shrink-0">
                                    {log.status === "SUCCESS" && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                                    {log.status === "FAILED" && <XCircle className="w-4 h-4 text-rose-400" />}
                                    {log.status === "QUEUED" && <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />}
                                </span>
                                <span className="px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider shrink-0"
                                    style={{
                                        background: `${MARKET_COLORS[log.marketplace] ?? "#94a3b8"}18`,
                                        color: MARKET_COLORS[log.marketplace] ?? "#94a3b8",
                                        border: `1px solid ${MARKET_COLORS[log.marketplace] ?? "#94a3b8"}30`,
                                    }}>
                                    {log.marketplace}
                                </span>
                                <span className="text-xs text-neutral-500 flex-1 truncate group-hover:text-neutral-400 transition-colors">
                                    {log.log_output || log.error_message || (log.status === "QUEUED" ? "Processing..." : "—")}
                                </span>
                                <span className="text-xs text-neutral-700 shrink-0 group-hover:text-neutral-600 transition-colors">
                                    {new Date(log.started_at).toLocaleString()}
                                </span>
                            </motion.div>
                        ))}
                    </div>
                )}
            </motion.div>
        </div>
    )
}

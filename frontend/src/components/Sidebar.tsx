"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Activity, Calendar, LayoutDashboard, Settings, Shapes, TrendingUp } from "lucide-react"

export default function Sidebar() {
    const pathname = usePathname()

    const links = [
        { name: "Dashboard", href: "/", icon: LayoutDashboard },
        { name: "Keyword Analytics", href: "/analytics", icon: TrendingUp },
        { name: "Execution Logs", href: "/logs", icon: Activity },
        { name: "Schedules", href: "/schedules", icon: Calendar },
        { name: "ASIN Management", href: "/asins", icon: Shapes },
        { name: "Settings", href: "/settings", icon: Settings },
    ]

    return (
        <aside className="w-64 h-screen shrink-0 border-r border-white/10 glass flex flex-col pt-8">
            <div className="px-6 mb-8">
                <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Cerebro Control</h1>
                <p className="text-xs text-neutral-400 mt-1">Helium10 Automations</p>
            </div>

            <nav className="flex-1 px-4 space-y-2">
                {links.map((link) => {
                    const isActive = pathname === link.href
                    return (
                        <Link key={link.name} href={link.href} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${isActive ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.1)]" : "text-neutral-400 hover:bg-white/5 border border-transparent hover:border-white/10"}`}>
                            <link.icon className={`h-5 w-5 ${isActive ? "text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.6)]" : "text-neutral-500"}`} />
                            <span className="font-medium text-sm">{link.name}</span>
                        </Link>
                    )
                })}
            </nav>

        </aside>
    )
}

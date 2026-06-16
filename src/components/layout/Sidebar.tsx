import { NavLink } from 'react-router-dom'
import { LayoutDashboard, FileText, LogOut, ChevronRight, FlaskConical, Database } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { isPreviewMode } from '../../lib/supabase'
import { clsx } from 'clsx'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/quotes', label: 'Quotes', icon: FileText, exact: false },
]

const engineerItems = [
  { to: '/price-tables', label: 'Price Tables', icon: Database, exact: false },
]

export default function Sidebar() {
  const { profile, signOut } = useAuthStore()
  const showEngineering = true  // all authenticated users can access price tables

  return (
    <aside className="w-56 shrink-0 flex flex-col bg-slate-900 border-r border-slate-800">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-slate-800">
        <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        </div>
        <span className="text-sm font-semibold text-white leading-tight">
          SCE<br />
          <span className="text-slate-400 font-normal">Quote Tool</span>
        </span>
      </div>

      {/* Preview mode banner */}
      {isPreviewMode && (
        <div className="mx-2 mt-2 px-2.5 py-2 bg-amber-900/30 border border-amber-800/50 rounded-lg
                        flex items-center gap-2">
          <FlaskConical className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <div>
            <p className="text-xs font-medium text-amber-300">Preview Mode</p>
            <p className="text-xs text-amber-500/80">No Supabase connected</p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {navItems.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}

        {showEngineering && (
          <>
            <div className="pt-3 pb-1 px-2">
              <span className="text-xs text-slate-600 font-medium uppercase tracking-wider">Engineering</span>
            </div>
            {engineerItems.map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
          </>
        )}
      </nav>

      {/* User / footer */}
      <div className="px-2 pb-3 border-t border-slate-800 pt-3">
        {isPreviewMode ? (
          <div className="px-2 py-1.5">
            <p className="text-xs text-slate-600">Connect Supabase to log in</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2.5 px-2 py-1.5 mb-1">
              <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                <span className="text-xs font-medium text-slate-300">
                  {profile?.full_name?.charAt(0).toUpperCase() ?? '?'}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm text-white truncate">{profile?.full_name ?? 'Unknown'}</p>
                <p className="text-xs text-slate-500 capitalize">{profile?.role}</p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-slate-400
                         hover:text-white hover:bg-slate-800 rounded-md transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </>
        )}
      </div>
    </aside>
  )
}

function NavItem({
  to, label, icon: Icon, exact,
}: {
  to: string; label: string; icon: React.ElementType; exact: boolean
}) {
  return (
    <NavLink
      to={to}
      end={exact}
      className={({ isActive }) =>
        clsx(
          'flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors group',
          isActive
            ? 'bg-brand-900/40 text-brand-300'
            : 'text-slate-400 hover:text-white hover:bg-slate-800'
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={clsx('w-4 h-4 shrink-0', isActive ? 'text-brand-400' : '')} />
          <span className="flex-1">{label}</span>
          {isActive && <ChevronRight className="w-3 h-3 text-brand-500" />}
        </>
      )}
    </NavLink>
  )
}

import { NavLink } from 'react-router-dom'
import { useAuth } from '../../stores/auth'

const NAV = [
  { to: '/',              icon: '📊', label: 'لوحة التحكم'    },
  { to: '/inventory',     icon: '💊', label: 'المخزون'        },
  { to: '/prescriptions', icon: '📋', label: 'الوصفات'        },
  { to: '/customers',     icon: '👥', label: 'المرضى'         },
  { to: '/suppliers',     icon: '🏭', label: 'الموردون'       },
  { to: '/expenses',      icon: '💰', label: 'المصروفات'      },
  { to: '/staff',         icon: '👔', label: 'الموظفون'       },
  { to: '/notifications', icon: '🔔', label: 'الإشعارات'      },
] as const

const BOTTOM_NAV = [
  { to: '/telegram', icon: '📱', label: 'تيليجرام' },
  { to: '/settings', icon: '⚙️',  label: 'الإعدادات' },
  { to: '/support',  icon: '💬', label: 'الدعم' },
] as const

export default function Sidebar() {
  const { user, logout } = useAuth()

  return (
    <aside className="fixed top-0 right-0 h-screen w-[var(--sidebar-w)] bg-slate-900 border-l border-slate-700 flex flex-col z-40">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-slate-700 shrink-0">
        <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-lg shrink-0">💊</div>
        <div>
          <p className="text-sm font-bold text-white leading-tight">نوبكو فارما</p>
          <p className="text-xs text-slate-500 truncate max-w-[140px]">{user?.pharmacyName}</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
          >
            <span className="text-base w-5 text-center shrink-0">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Bottom nav */}
      <div className="px-2 py-3 border-t border-slate-700 space-y-0.5">
        {BOTTOM_NAV.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
          >
            <span className="text-base w-5 text-center shrink-0">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>

      {/* User */}
      <div className="px-3 py-3 border-t border-slate-700 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-700 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0">
            {user?.name?.[0] || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
            <p className="text-xs text-slate-500">{user?.role === 'admin' ? 'مدير' : user?.role === 'pharmacist' ? 'صيدلاني' : 'كاشير'}</p>
          </div>
          <button onClick={logout} className="text-slate-500 hover:text-red-400 transition-colors text-sm" title="تسجيل الخروج">
            ↩
          </button>
        </div>
      </div>
    </aside>
  )
}

import { useCallback, useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  RiBankCardLine,
  RiBarChartBoxLine,
  RiBriefcaseLine,
  RiCalendarCheckLine,
  RiDashboardLine,
  RiGroupLine,
  RiLogoutBoxRLine,
  RiMenuLine,
  RiNotification3Line,
  RiScalesLine,
  RiSettings4Line,
  RiShieldCheckLine,
  RiShieldStarLine,
  RiStarLine,
  RiUserStarLine,
} from 'react-icons/ri';
import { useAuth } from '../context/AuthContext';
import { getInitials } from '../utils/format';
import { getNotifications } from '../services/api';

const navItems = [
  { icon: RiDashboardLine, label: 'Dashboard', to: '/admin/dashboard' },
  { icon: RiBarChartBoxLine, label: 'Analytics', to: '/admin/analytics' },
  { icon: RiUserStarLine, label: 'Fundis', to: '/admin/fundis' },
  { icon: RiShieldCheckLine, label: 'Verification', to: '/admin/verification' },
  { icon: RiGroupLine, label: 'Clients', to: '/admin/clients' },
  { icon: RiCalendarCheckLine, label: 'Bookings', to: '/admin/bookings' },
  { icon: RiBriefcaseLine, label: 'Jobs', to: '/admin/jobs' },
  { icon: RiScalesLine, label: 'Disputes', to: '/admin/disputes' },
  { icon: RiBankCardLine, label: 'Payments', to: '/admin/payments' },
  { icon: RiStarLine, label: 'Reviews', to: '/admin/reviews' },
  { icon: RiNotification3Line, label: 'Notifications', to: '/admin/notifications' },
  { icon: RiSettings4Line, label: 'Settings', to: '/admin/settings' },
];

const Sidebar = () => {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const { admin, logout } = useAuth();
  const navigate = useNavigate();

  const fetchUnread = useCallback(async () => {
    try {
      const res = await getNotifications({ limit: 1 });
      setUnread(res.data?.unread || 0);
    } catch {
    }
  }, []);

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [fetchUnread]);

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="md:hidden fixed left-4 top-4 z-50 p-2 bg-bg-raised border border-border rounded-input text-white hover:text-primary transition-colors duration-200"
        aria-label="Open navigation"
      >
        <RiMenuLine />
      </button>
      {open && <button type="button" className="md:hidden fixed inset-0 bg-black/70 z-40" onClick={() => setOpen(false)} aria-label="Close navigation" />}
      <aside className={`fixed left-0 top-0 h-screen w-60 bg-[#111111] border-r border-border flex flex-col z-50 transition-transform duration-200 ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="px-6 py-5 border-b border-border">
          <div className="text-primary font-black text-lg flex items-center gap-2">
            <RiShieldStarLine />
            <span>Ufundi UG</span>
          </div>
          <div className="text-muted text-xs mt-0.5">Admin Panel</div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  isActive
                    ? 'flex items-center gap-3 px-4 py-3 rounded-input text-primary text-sm font-medium bg-primary/10 border-l-[3px] border-primary'
                    : 'flex items-center gap-3 px-4 py-3 rounded-input text-muted text-sm font-medium hover:bg-white/5 hover:text-white transition-all duration-200'
                }
              >
                <Icon className="text-lg" />
                <span className="flex-1">{item.label}</span>
                {item.to === '/admin/notifications' && unread > 0 && (
                  <span className="bg-primary text-primary-text text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{unread}</span>
                )}
              </NavLink>
            );
          })}
        </nav>
        <div className="px-4 py-4 border-t border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-text font-black text-sm">
              {getInitials(admin?.name || admin?.email)}
            </div>
            <div className="min-w-0">
              <div className="text-white text-sm font-semibold truncate">{admin?.name || 'Admin User'}</div>
              <div className="text-muted text-xs truncate">{admin?.email || 'admin@ufundi.ug'}</div>
            </div>
          </div>
          <button type="button" onClick={handleLogout} className="mt-3 w-full flex items-center gap-2 px-3 py-2 rounded-input text-danger text-sm hover:bg-danger/10 transition-colors duration-200">
            <RiLogoutBoxRLine />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;

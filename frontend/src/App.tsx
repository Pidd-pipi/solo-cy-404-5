import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { FileText, IdCard, LayoutTemplate, MoonStar, Target } from 'lucide-react';
import { ThemeToggle } from './components/common/ThemeToggle';

const navItems = [
  { to: '/resumes', label: '简历', icon: FileText, match: (path: string) => path.startsWith('/resumes') },
  { to: '/jobs', label: '岗位匹配', icon: Target, match: (path: string) => path.startsWith('/jobs') },
  { to: '/templates', label: '模板', icon: LayoutTemplate, match: (path: string) => path.startsWith('/templates') },
  { to: '/profile', label: '个人资料', icon: IdCard, match: (path: string) => path.startsWith('/profile') },
];

export function AppLayout() {
  const location = useLocation();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-4 px-5 py-4">
          <NavLink className="flex items-center gap-3" to="/resumes">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--surface-strong)] text-[var(--ink-invert)]">
              <MoonStar size={19} aria-hidden />
            </span>
            <span>
              <span className="block font-display text-xl font-semibold leading-5">智能简历构建器</span>
              <span className="block text-xs text-[var(--muted)]">Local resume studio</span>
            </span>
          </NavLink>
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const active = item.match(location.pathname);
              return (
                <NavLink
                  className={`inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold transition ${
                    active
                      ? 'bg-[var(--surface-strong)] text-[var(--ink-invert)]'
                      : 'text-[var(--muted)] hover:bg-[var(--surface-alt)]'
                  }`}
                  key={item.to}
                  to={item.to}
                >
                  <item.icon size={16} aria-hidden />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto max-w-[1480px] px-5 py-6">
        <Outlet />
      </main>
    </div>
  );
}


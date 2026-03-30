import { Outlet, Link, useLocation } from "react-router";
import { LayoutDashboard, KanbanSquare, MessageSquare, BarChart3, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export function Layout() {
  const location = useLocation();

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/" },
    { icon: KanbanSquare, label: "Funil de Vendas", path: "/pipeline" },
    { icon: MessageSquare, label: "Conversas", path: "/conversations" },
    { icon: BarChart3, label: "Relatórios", path: "/reports" },
  ];

  const getPageTitle = (path: string) => {
    switch(path) {
      case '/': return 'Dashboard';
      case '/pipeline': return 'Funil de Vendas';
      case '/conversations': return 'Conversas';
      case '/reports': return 'Relatórios';
      case '/settings': return 'Configurações';
      default: return 'OmniCRM';
    }
  };

  return (
    <div className="flex h-screen w-full bg-slate-50">
      <aside className="w-64 border-r bg-white flex flex-col">
        <div className="h-16 flex items-center px-6 border-b">
          <div className="flex items-center gap-2 font-bold text-xl text-slate-900">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
              <MessageSquare size={18} />
            </div>
            OmniCRM
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-blue-50 text-blue-700" 
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <item.icon size={18} className={isActive ? "text-blue-700" : "text-slate-400"} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t">
          <Link 
            to="/settings"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium w-full transition-colors",
              location.pathname === '/settings'
                ? "bg-blue-50 text-blue-700" 
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            <Settings size={18} className={location.pathname === '/settings' ? "text-blue-700" : "text-slate-400"} />
            Configurações
          </Link>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b flex items-center justify-between px-6">
          <h1 className="text-lg font-semibold text-slate-800">
            {getPageTitle(location.pathname)}
          </h1>
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-sm font-medium text-slate-600">
              AD
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

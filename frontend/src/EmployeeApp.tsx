// Employee-facing PWA. Lives under /me/* and uses the session cookie set by
// the magic-link verify flow. No WebSocket, no agents, no admin endpoints —
// only what the employee themselves needs.

import { useCallback, useEffect, useState } from "react";
import { employeeApi, type EmployeeMe } from "./employee-api";
import { EmployeeLogin } from "./components/employee/EmployeeLogin";
import { EmployeeHome } from "./components/employee/EmployeeHome";
import { EmployeeNewRequest } from "./components/employee/EmployeeNewRequest";
import { EmployeeHistory } from "./components/employee/EmployeeHistory";
import { EmployeeApprovals } from "./components/employee/EmployeeApprovals";
import { IOSInstallBanner } from "./components/employee/IOSInstallBanner";

type EmpView = "home" | "new-request" | "history" | "approvals";

function pathToView(path: string): EmpView {
  if (path.startsWith("/me/new-request")) return "new-request";
  if (path.startsWith("/me/history")) return "history";
  if (path.startsWith("/me/approvals")) return "approvals";
  return "home";
}

function navTo(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

interface ManagerStatus {
  is_manager: boolean;
  reports_count: number;
  pending_count: number;
}

export function EmployeeApp() {
  const [me, setMe] = useState<EmployeeMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<EmpView>(() => pathToView(window.location.pathname));
  const [mgr, setMgr] = useState<ManagerStatus | null>(null);

  // Re-evaluate view on browser back/forward + on programmatic navTo()
  useEffect(() => {
    const onPop = () => setView(pathToView(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Refresh the manager-status badge whenever the view changes (cheap and
  // makes the badge feel live after the manager approves/rejects something).
  const refreshMgrStatus = useCallback(() => {
    employeeApi.isManager().then(setMgr).catch(() => setMgr(null));
  }, []);
  useEffect(() => {
    if (me) refreshMgrStatus();
  }, [me, view, refreshMgrStatus]);

  // Initial auth check (and re-check on visibility change in case the cookie
  // was set in another tab via the verify endpoint).
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const data = await employeeApi.me();
        if (alive) setMe(data);
      } catch {
        if (alive) setMe(null);
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    const onFocus = () => {
      if (!me) load();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return <CenteredPanel><div className="animate-pulse text-ink2">טוען…</div></CenteredPanel>;
  }

  if (!me) {
    return (
      <CenteredPanel>
        <EmployeeLogin onSubmit={async (email) => employeeApi.requestMagicLink(email)} />
      </CenteredPanel>
    );
  }

  const handleLogout = async () => {
    await employeeApi.logout().catch(() => null);
    setMe(null);
    navTo("/me");
  };

  return (
    <div className="min-h-screen flex flex-col bg-bg text-ink">
      <EmployeeNav me={me} view={view} mgr={mgr} onNav={navTo} onLogout={handleLogout} />
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6">
        {view === "home" && <EmployeeHome me={me} mgr={mgr} onNav={navTo} />}
        {view === "new-request" && (
          <EmployeeNewRequest me={me} onSubmitted={() => navTo("/me/history")} onCancel={() => navTo("/me")} />
        )}
        {view === "history" && <EmployeeHistory />}
        {view === "approvals" && <EmployeeApprovals />}
      </main>
      <IOSInstallBanner />
      <footer className="text-[11px] text-ink2 text-center py-4 border-t border-panel2">
        Shefi &amp; Co. · גרסה 2.5
      </footer>
    </div>
  );
}

function CenteredPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg text-ink flex items-center justify-center px-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

function EmployeeNav({
  me,
  view,
  mgr,
  onNav,
  onLogout,
}: {
  me: EmployeeMe;
  view: EmpView;
  mgr: ManagerStatus | null;
  onNav: (path: string) => void;
  onLogout: () => void;
}) {
  const showApprovals = mgr?.is_manager || (mgr?.pending_count ?? 0) > 0;
  return (
    <header className="bg-panel/80 backdrop-blur border-b border-panel2 sticky top-0 z-10">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <button
          onClick={() => onNav("/me")}
          className="flex items-center gap-2 group"
          aria-label="דף הבית"
        >
          <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center text-white font-extrabold text-lg leading-none">
            ש
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold leading-tight">Shefi &amp; Co.</div>
            <div className="text-[11px] text-ink2 leading-tight">{me.name_he ?? me.name}</div>
          </div>
        </button>
        <nav className="flex items-center gap-1 text-xs">
          <NavBtn active={view === "home"} onClick={() => onNav("/me")}>
            🏠 בית
          </NavBtn>
          <NavBtn active={view === "new-request"} onClick={() => onNav("/me/new-request")}>
            ➕ בקשה
          </NavBtn>
          <NavBtn active={view === "history"} onClick={() => onNav("/me/history")}>
            📋 שלי
          </NavBtn>
          {showApprovals && (
            <NavBtn
              active={view === "approvals"}
              onClick={() => onNav("/me/approvals")}
              badge={mgr?.pending_count ?? 0}
            >
              ✓ אישורים
            </NavBtn>
          )}
          <button
            onClick={onLogout}
            className="text-[11px] text-ink2 hover:text-dev px-2 py-1.5 rounded-md"
            title="יציאה"
          >
            ⎋
          </button>
        </nav>
      </div>
    </header>
  );
}

function NavBtn({
  active,
  onClick,
  children,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative px-3 py-1.5 rounded-md transition-colors ${
        active
          ? "bg-accent/20 text-accent border border-accent/40"
          : "text-ink2 hover:text-ink hover:bg-panel2"
      }`}
    >
      {children}
      {badge !== undefined && badge > 0 && (
        <span className="absolute -top-1 -left-1 bg-dev text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </button>
  );
}

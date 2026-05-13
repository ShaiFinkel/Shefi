export function OrgChartPage() {
  return (
    <div className="flex-1 flex flex-col bg-bg">
      <div className="flex items-center justify-between px-6 py-3 border-b border-panel2 bg-panel/40">
        <div>
          <h1 className="text-lg font-semibold">🌳 העץ הארגוני — Dragontail</h1>
          <p className="text-xs text-ink2 mt-0.5">
            שינויים נשמרים אוטומטית ומסונכרנים עם לשונית "עובדים".
          </p>
        </div>
        <a
          href="/orgchart.html"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-ink2 hover:text-accent"
        >
          פתח בחלון נפרד ↗
        </a>
      </div>
      <iframe
        src="/orgchart.html"
        title="Org Chart"
        className="flex-1 w-full bg-white border-0"
      />
    </div>
  );
}

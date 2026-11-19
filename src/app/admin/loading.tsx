export default function AdminLoading() {
  return (
    <div className="ad-page" aria-busy="true" aria-live="polite">
      <span className="ad-sr-only">Loading…</span>
      <div className="ad-skel" style={{ width: 120, height: 10, marginBottom: 10 }} />
      <div className="ad-skel" style={{ width: 260, height: 30, marginBottom: 24 }} />
      <div className="ad-skel" style={{ height: 320 }} />
    </div>
  );
}

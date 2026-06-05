import { Console } from "@/components/Console";
import { HeaderActions } from "@/components/HeaderActions";

export default function Home() {
  return (
    <div className="shell">
      <header className="masthead">
        <div className="brandwrap">
          <svg className="brandmark" viewBox="0 0 32 32" fill="none" aria-hidden>
            <rect width="32" height="32" rx="8" fill="#141219" />
            <circle cx="16" cy="16" r="9" fill="none" stroke="#2a2633" strokeWidth="3.2" />
            <circle cx="16" cy="16" r="9" fill="none" stroke="#f5b43e" strokeWidth="3.2" strokeLinecap="round" strokeDasharray="42 57" transform="rotate(-90 16 16)" />
            <circle cx="16" cy="16" r="2.4" fill="#f5b43e" />
          </svg>
          <div className="brand">
            <span className="brand__name">ASO <b>Audit</b></span>
            <small>App Store Optimization</small>
          </div>
        </div>
        <HeaderActions />
      </header>
      <Console />
    </div>
  );
}

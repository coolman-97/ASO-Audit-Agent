import { Console } from "@/components/Console";

export default function Home() {
  return (
    <div className="shell">
      <header className="masthead">
        <div className="brand">
          ASO <b>Audit</b> Agent
        </div>
        <div className="tag">App Store Optimization · Mastra</div>
      </header>
      <Console />
    </div>
  );
}

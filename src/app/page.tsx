import { Console } from "@/components/Console";

export default function Home() {
  return (
    <div className="shell">
      <header className="masthead">
        <div className="brandwrap">
          <div className="brandmark">A</div>
          <div className="brand">
            ASO <b>Audit</b> Agent
            <small>App Store Optimization</small>
          </div>
        </div>
        <div className="tag">Powered by Mastra</div>
      </header>
      <Console />
    </div>
  );
}

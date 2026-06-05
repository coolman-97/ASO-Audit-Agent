"use client";

/** Right side of the masthead: a status indicator and a reset action. */
export function HeaderActions() {
  return (
    <div className="masthead__right">
      <span className="statuspill"><span className="statusdot" /> Ready</span>
      <button className="newbtn" onClick={() => window.location.reload()} title="Start a fresh audit">
        <span aria-hidden>＋</span> New audit
      </button>
    </div>
  );
}

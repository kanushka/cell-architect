import { Github, Info, Star, X } from "lucide-react";
import { useState } from "react";

const REPO_URL = "https://github.com/kanushka/cell-architect";

export function InfoPanel() {
  const [open, setOpen] = useState(false);

  return (
    <div className="info-panel">
      <button
        type="button"
        className="icon-button"
        aria-label={open ? "Close info" : "Open info"}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <X size={16} /> : <Info size={16} />}
      </button>
      {open ? (
        <div className="info-panel__popover" role="dialog" aria-label="About Cell Architect">
          <p className="info-panel__lede">Cell Architect is open source.</p>
          <a className="info-panel__link" href={REPO_URL} target="_blank" rel="noreferrer">
            <Github size={15} />
            <span>View on GitHub</span>
          </a>
          <a className="info-panel__link" href={REPO_URL} target="_blank" rel="noreferrer">
            <Star size={15} />
            <span>Star the repo</span>
          </a>
          <p className="info-panel__note">
            Diagrams are stored in this browser only. You can keep up to 10 at a time.
          </p>
        </div>
      ) : null}
    </div>
  );
}

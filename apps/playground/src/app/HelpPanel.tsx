import { HelpCircle, X } from "lucide-react";
import { useRef, useState } from "react";
import { GithubIcon } from "./EditorIcons";
import { useClickOutside } from "./useClickOutside";

const REPO_URL = "https://github.com/kanushka/cell-architect";

export function HelpPanel() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setOpen(false), open);

  return (
    <div className="help-panel" ref={containerRef}>
      <button
        type="button"
        className="icon-button"
        aria-label={open ? "Close help" : "Open help"}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <X size={16} /> : <HelpCircle size={16} />}
      </button>
      {open ? (
        <div className="help-panel__popover" role="dialog" aria-label="About Cell Architect">
          <p className="help-panel__lede">Cell Architect is open source.</p>
          <a className="help-panel__link" href={REPO_URL} target="_blank" rel="noreferrer">
            <GithubIcon size={15} />
            <span>View on GitHub</span>
          </a>
          <p className="help-panel__note">
            Diagrams are stored in this browser only. You can keep up to 10 at a time.
          </p>
        </div>
      ) : null}
    </div>
  );
}

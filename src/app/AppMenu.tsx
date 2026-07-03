import { BookOpen, FilePlus2, Menu, Upload } from "lucide-react";
import { useState } from "react";

interface AppMenuProps {
  onNewDocument: () => void;
  onImportClick: () => void;
  onOpenGuide: () => void;
  disableCreateActions: boolean;
}

export function AppMenu({ onNewDocument, onImportClick, onOpenGuide, disableCreateActions }: AppMenuProps) {
  const [open, setOpen] = useState(false);

  function handleSelect(action: () => void) {
    action();
    setOpen(false);
  }

  return (
    <div className="app-menu">
      <button
        type="button"
        className="app-menu__trigger icon-button"
        aria-label="Open main menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Menu size={18} />
      </button>
      {open ? (
        <div className="app-menu__dropdown" role="menu">
          <button
            type="button"
            role="menuitem"
            disabled={disableCreateActions}
            onClick={() => handleSelect(onNewDocument)}
          >
            <FilePlus2 size={15} />
            <span>New diagram</span>
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={disableCreateActions}
            onClick={() => handleSelect(onImportClick)}
          >
            <Upload size={15} />
            <span>Import .cell</span>
          </button>
          <button type="button" role="menuitem" onClick={() => handleSelect(onOpenGuide)}>
            <BookOpen size={15} />
            <span>DSL Guide</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

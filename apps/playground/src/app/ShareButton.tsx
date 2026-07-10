import { Check, Copy, Share2 } from "lucide-react";
import { useState } from "react";
import { buildShareUrl } from "../share/shareLink";
import { Modal } from "./Modal";

interface ShareButtonProps {
  source: string;
}

async function writeClipboardText(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // Fall back to the legacy copy path below.
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();

  if (!copied) {
    throw new Error("Unable to copy share link.");
  }
}

export function ShareButton({ source }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState("");

  function handleOpen() {
    setShareUrl(buildShareUrl(source));
    setCopied(false);
    setOpen(true);
  }

  async function handleCopy() {
    try {
      await writeClipboardText(shareUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <div className="share-button">
        <button type="button" className="share-button__trigger" onClick={handleOpen}>
          <Share2 size={15} />
          <span>Share</span>
        </button>
      </div>

      {open ? (
        <Modal title="Share diagram" onClose={() => setOpen(false)}>
          <p>Anyone with this link can open a copy of this diagram. No account or server involved.</p>
          <div className="share-link-row">
            <input type="text" readOnly value={shareUrl} onFocus={(event) => event.target.select()} />
            <button type="button" className="pill-button" onClick={() => void handleCopy()}>
              {copied ? <Check size={15} /> : <Copy size={15} />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

import { Check, Copy, X } from "lucide-react";
import { useState } from "react";
import { defaultSampleSource } from "../storage/defaultSample";

const notationSections = [
  {
    title: "Metadata",
    detail: "Set the diagram title and optional version.",
    code: "title OrderProject\nversion v1"
  },
  {
    title: "Components",
    detail: "Create internal components with an id, with or without a type.",
    code: "component usersAPI\ncomponent WebApp web-app\ncomponent OrderService service"
  },
  {
    title: "Boundary declarations",
    detail: "Predeclare external systems on a boundary, with or without a type, then reference them in arrows.",
    code: "north CustomerApp\neast InventoryAPI api\nsouth Stripe payment"
  },
  {
    title: "Internal dependencies",
    detail: "Connect internal components inside the cell.",
    code: "WebApp -> api\napi -> OrderService\nOrderService -> odb"
  },
  {
    title: "Boundary dependencies",
    detail: "Declared externals can be used in plain arrows. Inline boundary arrows still work too.",
    code: "CustomerApp -> WebApp\nOrderService -> InventoryAPI\nnorth CustomerApp -> OrderAPI\nOrderService -> east InventoryCell"
  },
  {
    title: "Gateway exposure",
    detail: "Expose an internal component through a gateway when the external consumer is unknown.",
    code: "north -> api\napi -> east"
  },
  {
    title: "Aliases",
    detail:
      "Use \"as\" to set a display label on a component or external. A label is one word by default; wrap it in quotes for multiple words.",
    code: "component api as OrderAPI\nsouth db as Datastore\ncomponent odb as \"Order Datastore\"\nsouth adb as \"Azure Postgre\" database"
  },
  {
    title: "Labels in dependencies",
    detail: "Add a label after a colon on any dependency arrow.",
    code: "OrderService -> EventPublisher : order.created\nCustomerApp -> WebApp : HTTPS\nOrderService -> InventoryAPI : reserve stock"
  },
  {
    title: "Comments",
    detail: "Use hash or double-slash comments. Blank lines are ignored.",
    code: "# Customer entry points\n// Back office path"
  },
  {
    title: "Full sample",
    detail: "A complete order system diagram using each supported notation.",
    code: defaultSampleSource
  }
];

interface DslGuideProps {
  onClose: () => void;
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
    throw new Error("Unable to copy DSL example.");
  }
}

export function DslGuide({ onClose }: DslGuideProps) {
  const [copiedTitle, setCopiedTitle] = useState<string | null>(null);

  async function copyCode(title: string, code: string) {
    try {
      await writeClipboardText(code);
      setCopiedTitle(title);
    } catch {
      setCopiedTitle(null);
    }
  }

  return (
    <div className="guide-backdrop">
      <section className="guide-dialog" role="dialog" aria-modal="true" aria-labelledby="dsl-guide-title">
        <header className="guide-header">
          <div>
            <p>Quick reference</p>
            <h2 id="dsl-guide-title">Cell DSL Guide</h2>
          </div>
          <button type="button" className="icon-button" aria-label="Close DSL guide" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="guide-content">
          {notationSections.map((section) => (
            <article className="guide-section" key={section.title}>
              <div className="guide-section__copy">
                <div>
                  <h3>{section.title}</h3>
                  <p>{section.detail}</p>
                </div>
                <button
                  type="button"
                  aria-label={`Copy ${section.title} example`}
                  onClick={() => void copyCode(section.title, section.code)}
                >
                  {copiedTitle === section.title ? <Check size={15} /> : <Copy size={15} />}
                  <span>{copiedTitle === section.title ? "Copied" : "Copy"}</span>
                </button>
              </div>
              <pre>
                <code>{section.code}</code>
              </pre>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

import { Check, Copy, X } from "lucide-react";
import { useState } from "react";
import { defaultSampleSource } from "../storage/defaultSample";

interface NotationExample {
  label?: string;
  code: string;
}

interface NotationSection {
  title: string;
  detail: string;
  examples: NotationExample[];
}

const notationSections: NotationSection[] = [
  {
    title: "Metadata",
    detail: "Set the diagram title and optional version.",
    examples: [{ code: "title OrderProject\nversion v1" }]
  },
  {
    title: "Components",
    detail: "Create internal components with an id, with or without a type.",
    examples: [{ code: "component usersAPI\ncomponent WebApp web-app\ncomponent OrderService service" }]
  },
  {
    title: "Boundary declarations",
    detail: "Predeclare external systems on a boundary, with or without a type, then reference them in arrows.",
    examples: [{ code: "north CustomerApp\neast InventoryAPI api\nsouth Stripe payment" }]
  },
  {
    title: "Internal dependencies",
    detail:
      "Declare components, then connect them. You can also skip the declaration and let Cell Architect infer a plain component.",
    examples: [
      { label: "With declaration", code: "component api\ncomponent OrderService\n\napi -> OrderService" },
      { label: "Without declaration", code: "api -> OrderService" }
    ]
  },
  {
    title: "Boundary dependencies",
    detail:
      "Declare an external, then connect it. You can also skip the declaration and create the dependency inline.",
    examples: [
      {
        label: "With declaration",
        code: "north CustomerApp\neast InventoryAPI\n\nCustomerApp -> WebApp\nOrderService -> InventoryAPI"
      },
      {
        label: "Without declaration (inline)",
        code: "north PartnerPortal -> OrderAPI\nOrderService -> east InventoryAPI"
      }
    ]
  },
  {
    title: "Gateway exposure",
    detail: "Expose an internal component through a gateway when the external consumer is unknown.",
    examples: [{ code: "north -> api\napi -> east" }]
  },
  {
    title: "Aliases",
    detail:
      "Use \"as\" to set a display label on a component or external. A label is one word by default; wrap it in quotes for multiple words.",
    examples: [
      {
        code: "component api as OrderAPI\nsouth db as Datastore\ncomponent odb as \"Order Datastore\"\nsouth adb as \"Azure Postgre\" database"
      }
    ]
  },
  {
    title: "Labels in dependencies",
    detail: "Add a label after a colon on any dependency arrow.",
    examples: [
      {
        code: "OrderService -> EventPublisher : order.created\nCustomerApp -> WebApp : HTTPS\nOrderService -> InventoryAPI : reserve stock"
      }
    ]
  },
  {
    title: "Comments",
    detail: "Use hash or double-slash comments. Blank lines are ignored.",
    examples: [{ code: "# Customer entry points\n// Back office path" }]
  },
  {
    title: "Full sample",
    detail: "A complete order system diagram using each supported notation.",
    examples: [{ code: defaultSampleSource }]
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
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  async function copyCode(key: string, code: string) {
    try {
      await writeClipboardText(code);
      setCopiedKey(key);
    } catch {
      setCopiedKey(null);
    }
  }

  return (
    <div className="guide-backdrop" onClick={onClose}>
      <section
        className="guide-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dsl-guide-title"
        onClick={(event) => event.stopPropagation()}
      >
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
          {notationSections.map((section) => {
            const isSingleUnlabeled = section.examples.length === 1 && !section.examples[0].label;

            return (
              <article className="guide-section" key={section.title}>
                <div className="guide-section__copy">
                  <div>
                    <h3>{section.title}</h3>
                    <p>{section.detail}</p>
                  </div>
                  {isSingleUnlabeled && (
                    <button
                      type="button"
                      aria-label={`Copy ${section.title} example`}
                      onClick={() => void copyCode(`${section.title}::0`, section.examples[0].code)}
                    >
                      {copiedKey === `${section.title}::0` ? <Check size={15} /> : <Copy size={15} />}
                      <span>{copiedKey === `${section.title}::0` ? "Copied" : "Copy"}</span>
                    </button>
                  )}
                </div>

                {isSingleUnlabeled ? (
                  <pre>
                    <code>{section.examples[0].code}</code>
                  </pre>
                ) : (
                  section.examples.map((example, index) => {
                    const key = `${section.title}::${index}`;
                    const copyLabel = example.label
                      ? `Copy ${section.title} ${example.label} example`
                      : `Copy ${section.title} example`;

                    return (
                      <div className="guide-example" key={key}>
                        <div className="guide-example__copy">
                          <span className="guide-example__label">{example.label}</span>
                          <button
                            type="button"
                            aria-label={copyLabel}
                            onClick={() => void copyCode(key, example.code)}
                          >
                            {copiedKey === key ? <Check size={15} /> : <Copy size={15} />}
                            <span>{copiedKey === key ? "Copied" : "Copy"}</span>
                          </button>
                        </div>
                        <pre>
                          <code>{example.code}</code>
                        </pre>
                      </div>
                    );
                  })
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

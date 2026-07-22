import { Check, Copy, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { defaultSampleSource } from "../storage/defaultSample";

interface NotationExample {
  label?: string;
  code: string;
}

interface GuideTopic {
  title: string;
  detail: string;
  examples: NotationExample[];
}

interface GuideSection {
  id: string;
  title: string;
  detail: string;
  topics: GuideTopic[];
}

interface GuideGroup {
  title: string;
  beta?: boolean;
  sections: GuideSection[];
}

const multiCellSampleSource = `title CommercePlatform

cell orders as "Order Cell" {
  version v2
  component api as OrderAPI service
  component db as OrderDB database
  north customerApp as "Customer App" web-app

  customerApp -> api : HTTPS
  api -> db
  api -> products.api : check stock
  api -> east s3
}

cell products as "Product Cell" {
  component api as ProductAPI service
  component db as ProductDB database
  south s3 as "AWS S3" storage

  api -> db
  api -> s3
}`;

const guideGroups: GuideGroup[] = [
  {
    title: "Core DSL",
    sections: [
      {
        id: "initial-diagram",
        title: "Initial diagram",
        detail: "Create the components and boundaries of your first cell.",
        topics: [
          {
            title: "Components",
            detail: "Create internal components with an id, with or without a type.",
            examples: [{ code: "component usersAPI\ncomponent WebApp web-app\ncomponent OrderService service" }]
          },
          {
            title: "Boundary declarations",
            detail: "Place external systems on the north, east, south, or west boundary.",
            examples: [{ code: "north CustomerApp\neast InventoryAPI api\nsouth Stripe payment" }]
          }
        ]
      },
      {
        id: "dependencies",
        title: "Dependencies",
        detail: "Connect internal components and systems across the cell boundary.",
        topics: [
          {
            title: "Internal dependencies",
            detail: "Declare components first, or let Cell Architect infer plain components from an arrow.",
            examples: [
              { label: "With declarations", code: "component api\ncomponent OrderService\n\napi -> OrderService" },
              { label: "Inferred components", code: "api -> OrderService" }
            ]
          },
          {
            title: "Boundary dependencies",
            detail: "Connect a declared external, or create the external inline with its boundary direction.",
            examples: [
              {
                label: "With declarations",
                code: "north CustomerApp\neast InventoryAPI\n\nCustomerApp -> WebApp\nOrderService -> InventoryAPI"
              },
              {
                label: "Inline externals",
                code: "north PartnerPortal -> OrderAPI\nOrderService -> east InventoryAPI"
              }
            ]
          },
          {
            title: "Dependency labels",
            detail: "Add a label after a colon on any dependency arrow.",
            examples: [
              {
                code: "OrderService -> EventPublisher : order.created\nCustomerApp -> WebApp : HTTPS\nOrderService -> InventoryAPI : reserve stock"
              }
            ]
          }
        ]
      },
      {
        id: "gateways",
        title: "Gateways",
        detail: "Expose components through a cell boundary when the external consumer is unknown.",
        topics: [
          {
            title: "Gateway exposure",
            detail: "Connect directly to a gateway without creating an external component.",
            examples: [{ code: "north -> api\napi -> east" }]
          },
          {
            title: "Direction rules",
            detail: "North and west flow into the cell. East and south flow out of the cell.",
            examples: [{ code: "# inbound\nnorth -> API\nwest -> API\n\n# outbound\nAPI -> east\nAPI -> south" }]
          }
        ]
      },
      {
        id: "metadata",
        title: "Metadata",
        detail: "Add an optional title and version to the cell boundary.",
        topics: [
          {
            title: "Title and version",
            detail: "Metadata is optional; omit both to render the boundary without a title label.",
            examples: [{ code: "title OrderProject\nversion v1" }]
          }
        ]
      },
      {
        id: "single-cell-sample",
        title: "Complete single-cell sample",
        detail: "A complete diagram combining the core single-cell notation.",
        topics: [
          {
            title: "Single-cell DSL",
            detail: "Copy this sample into the editor to explore a complete cell.",
            examples: [{ code: defaultSampleSource }]
          }
        ]
      }
    ]
  },
  {
    title: "Multi-cell",
    beta: true,
    sections: [
      {
        id: "cell-blocks",
        title: "Cell blocks and project title",
        detail: "Group each cell inside a block and optionally set an overall project title.",
        topics: [
          {
            title: "Cell blocks",
            detail: "Everything valid in a single cell is valid inside a cell block.",
            examples: [
              {
                code: 'title CommercePlatform\n\ncell orders as "Order Cell" {\n  version v2\n  component api\n}\n\ncell products {\n  component api\n}'
              }
            ]
          }
        ]
      },
      {
        id: "cross-cell-links",
        title: "Cross-cell links",
        detail: "Use a dot-qualified component id to connect one cell to another.",
        topics: [
          {
            title: "Inside a cell block",
            detail: "The source may be a local id; qualify the target as cell.component.",
            examples: [
              {
                code: "cell orders {\n  component api\n  api -> products.api : get stock\n}\n\ncell products {\n  component api\n}"
              }
            ]
          },
          {
            title: "At project level",
            detail: "Outside cell blocks, qualify both the source and target.",
            examples: [{ code: "orders.api -> products.api : get stock" }]
          }
        ]
      },
      {
        id: "connection-modes",
        title: "Connected and decoupled modes",
        detail: "Choose a joined cross-cell line or independent boundary markers with the direction token.",
        topics: [
          {
            title: "Connected",
            detail: "East exit is connected mode; west is the default entry direction.",
            examples: [
              { label: "Default east/west", code: "api -> products.api" },
              { label: "Custom north entry", code: "api -> east-north products.api" }
            ]
          },
          {
            title: "Decoupled",
            detail: "South exit uses independent markers and requires an explicit west or north entry.",
            examples: [
              { label: "Enter from north", code: "api -> south-north products.api : callback" },
              { label: "Enter from west", code: "api -> south-west products.api" }
            ]
          }
        ]
      },
      {
        id: "shared-externals",
        title: "Shared externals",
        detail: "An external id used by two or more cells becomes one shared node.",
        topics: [
          {
            title: "Shared external system",
            detail: "Each cell may use its own boundary direction while sharing the rendered external.",
            examples: [
              {
                code: 'cell orders {\n  component api\n  api -> east s3\n}\n\ncell products {\n  component api\n  south s3 as "AWS S3" storage\n  api -> s3\n}'
              }
            ]
          }
        ]
      },
      {
        id: "multi-cell-sample",
        title: "Complete multi-cell sample",
        detail: "A complete project with cross-cell links and a shared external.",
        topics: [
          {
            title: "Multi-cell DSL",
            detail: "Copy this sample into the editor to explore the beta multi-cell notation.",
            examples: [{ code: multiCellSampleSource }]
          }
        ]
      }
    ]
  },
  {
    title: "Reference",
    sections: [
      {
        id: "aliases",
        title: "Aliases",
        detail: "Use as to separate a stable DSL id from the label rendered on the diagram.",
        topics: [
          {
            title: "Display labels",
            detail: "Wrap multi-word labels in quotes; an optional type may follow the label.",
            examples: [
              {
                code: 'component api as OrderAPI\nsouth db as Datastore\ncomponent odb as "Order Datastore"\nsouth adb as "Azure Postgre" database'
              }
            ]
          }
        ]
      },
      {
        id: "comments",
        title: "Comments",
        detail: "Use hash or double-slash comments. Blank lines are ignored.",
        topics: [
          {
            title: "Comment styles",
            detail: "Comments can document intent without affecting the rendered diagram.",
            examples: [{ code: "# Customer entry points\n// Back office path" }]
          }
        ]
      }
    ]
  }
];

const allSections = guideGroups.flatMap((group) => group.sections);

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

function GuideNavigation({ activeSectionId, onSelect }: { activeSectionId: string; onSelect: (id: string) => void }) {
  return (
    <nav className="guide-navigation" aria-label="DSL guide contents">
      {guideGroups.map((group) => (
        <div className="guide-navigation__group" key={group.title}>
          <div className="guide-navigation__group-label">
            <span>{group.title}</span>
            {group.beta ? <span className="guide-navigation__beta">BETA</span> : null}
          </div>
          {group.sections.map((section) => (
            <button
              type="button"
              className="guide-navigation__link"
              data-active={activeSectionId === section.id ? "true" : "false"}
              aria-current={activeSectionId === section.id ? "location" : undefined}
              onClick={() => onSelect(section.id)}
              key={section.id}
            >
              {section.title}
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}

export function DslGuide({ onClose }: DslGuideProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState(allSections[0].id);
  const [contentsOpen, setContentsOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const contentsButtonRef = useRef<HTMLButtonElement>(null);
  const contentsCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      if (contentsOpen) {
        setContentsOpen(false);
        window.requestAnimationFrame(() => contentsButtonRef.current?.focus());
      } else {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [contentsOpen, onClose]);

  useEffect(() => {
    if (!contentsOpen) {
      return;
    }

    window.requestAnimationFrame(() => contentsCloseRef.current?.focus());
  }, [contentsOpen]);

  useEffect(() => {
    const desktopQuery = window.matchMedia?.("(min-width: 641px)");
    if (!desktopQuery) {
      return;
    }

    function handleBreakpointChange(event: MediaQueryListEvent) {
      if (event.matches) {
        setContentsOpen(false);
      }
    }

    desktopQuery.addEventListener("change", handleBreakpointChange);
    return () => desktopQuery.removeEventListener("change", handleBreakpointChange);
  }, []);

  useEffect(() => {
    const contentElement = contentRef.current;
    if (!contentElement) {
      return;
    }

    let animationFrame = 0;

    function updateActiveSection() {
      animationFrame = 0;
      const readingEdge = contentElement!.getBoundingClientRect().top;
      let closestSectionId = allSections[0].id;
      let closestDistance = Number.POSITIVE_INFINITY;

      allSections.forEach((section) => {
        const target = document.getElementById(section.id);
        if (!target) {
          return;
        }

        const distance = Math.abs(target.getBoundingClientRect().top - readingEdge);
        if (distance < closestDistance) {
          closestSectionId = section.id;
          closestDistance = distance;
        }
      });

      setActiveSectionId(closestSectionId);
    }

    function handleScroll() {
      if (!animationFrame) {
        animationFrame = window.requestAnimationFrame(updateActiveSection);
      }
    }

    contentElement.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      contentElement.removeEventListener("scroll", handleScroll);
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, []);

  async function copyCode(key: string, code: string) {
    try {
      await writeClipboardText(code);
      setCopiedKey(key);
    } catch {
      setCopiedKey(null);
    }
  }

  function selectSection(sectionId: string) {
    const target = document.getElementById(sectionId);
    if (!target) {
      return;
    }

    setActiveSectionId(sectionId);
    target.scrollIntoView?.({ behavior: "smooth", block: "start" });
    setContentsOpen(false);
  }

  function closeContents() {
    setContentsOpen(false);
    window.requestAnimationFrame(() => contentsButtonRef.current?.focus());
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
          <button
            ref={contentsButtonRef}
            type="button"
            className="icon-button guide-header__contents-button"
            aria-label="Open contents"
            aria-controls="dsl-guide-mobile-contents"
            aria-expanded={contentsOpen}
            onClick={() => setContentsOpen(true)}
          >
            <Menu size={18} />
          </button>
          <div className="guide-header__title">
            <p>Quick reference</p>
            <h2 id="dsl-guide-title">Cell DSL Guide</h2>
          </div>
          <button type="button" className="icon-button guide-header__close" aria-label="Close DSL guide" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="guide-layout">
          <aside className="guide-sidebar">
            <GuideNavigation activeSectionId={activeSectionId} onSelect={selectSection} />
          </aside>

          <div className="guide-content" ref={contentRef}>
            {guideGroups.map((group) => (
              <div className="guide-content__group" key={group.title}>
                <div className="guide-content__group-heading">
                  <span>{group.title}</span>
                </div>
                {group.sections.map((section) => (
                  <article className="guide-section" id={section.id} key={section.id}>
                    <div className="guide-section__heading">
                      <h3>{section.title}</h3>
                      <p>{section.detail}</p>
                    </div>

                    <div className="guide-section__topics">
                      {section.topics.map((topic, topicIndex) => (
                        <section className="guide-topic" key={`${section.id}::${topic.title}`}>
                          <div className="guide-topic__heading">
                            <h4>{topic.title}</h4>
                            <p>{topic.detail}</p>
                          </div>
                          {topic.examples.map((example, exampleIndex) => {
                            const key = `${section.id}::${topicIndex}::${exampleIndex}`;
                            const copyLabel = example.label
                              ? `Copy ${topic.title} ${example.label} example`
                              : `Copy ${topic.title} example`;

                            return (
                              <div className="guide-example" key={key}>
                                <div className="guide-example__copy">
                                  {example.label ? <span className="guide-example__label">{example.label}</span> : <span />}
                                  <button type="button" aria-label={copyLabel} onClick={() => void copyCode(key, example.code)}>
                                    {copiedKey === key ? <Check size={15} /> : <Copy size={15} />}
                                    <span>{copiedKey === key ? "Copied" : "Copy"}</span>
                                  </button>
                                </div>
                                <pre>
                                  <code>{example.code}</code>
                                </pre>
                              </div>
                            );
                          })}
                        </section>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            ))}
          </div>
        </div>

        {contentsOpen ? (
          <div id="dsl-guide-mobile-contents" className="guide-mobile-contents">
            <header className="guide-mobile-contents__header">
              <span aria-hidden="true" />
              <h3>Contents</h3>
              <button
                ref={contentsCloseRef}
                type="button"
                className="icon-button"
                aria-label="Close contents"
                onClick={closeContents}
              >
                <X size={18} />
              </button>
            </header>
            <GuideNavigation activeSectionId={activeSectionId} onSelect={selectSection} />
          </div>
        ) : null}
      </section>
    </div>
  );
}

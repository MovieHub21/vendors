import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { ITEM_HEADERS, itemRows, paymentsContent, textLines, totalRows, type DocData } from "../lib/docContent";
import { PAGE_W, resolveLayout, templateToCss, type Block, type Template } from "../lib/docTemplate";

export interface DocumentEditing {
  onBlockPointerDown: (event: ReactPointerEvent<HTMLDivElement>, block: Block) => void;
}

interface Props {
  template: Template;
  doc: DocData;
  /** The CSS stored with the design. Left out in the designer, where it is generated from the template as you edit. */
  css?: string;
  /** Designer mode: blocks keep their designed size and can be grabbed. */
  editing?: DocumentEditing;
  /** Drawn inside the page, on top of the blocks (the designer puts its selection handles here). */
  children?: ReactNode;
  /** Tells the designer how much the page is scaled on this screen, so mouse movement maps to page pixels. */
  onScale?: (scale: number) => void;
}

function BlockBody({ block, doc, editing }: { block: Block; doc: DocData; editing: boolean }) {
  switch (block.type) {
    case "brand":
      return (
        <div className="ln">
          <span>Sell</span>
          <span className="accent">Sharp</span>
        </div>
      );
    case "logo":
      return doc.snapshot.business.logo_url ? <img src={doc.snapshot.business.logo_url} alt="" /> : editing ? <span className="doc-hint">Store logo</span> : null;
    case "image":
      return block.src ? <img src={block.src} alt="" /> : editing ? <span className="doc-hint">Add an image link</span> : null;
    case "items":
      return (
        <>
          <div className="th">
            <div className="c">{ITEM_HEADERS.name}</div>
            <div className="c">{ITEM_HEADERS.qty}</div>
            <div className="c r">{ITEM_HEADERS.price}</div>
            <div className="c r">{ITEM_HEADERS.amount}</div>
          </div>
          {itemRows(doc).map((row, index) => (
            <div className="tr" key={index}>
              <div className="c nm">{row.name}</div>
              <div className="c">{row.qty}</div>
              <div className="c r">{row.price}</div>
              <div className="c r">{row.amount}</div>
            </div>
          ))}
        </>
      );
    case "totals":
      return (
        <>
          {totalRows(doc).map((row) => (
            <div className={`kv${row.strong ? " strong" : ""}`} key={row.label}>
              <span>{row.label}</span>
              <span>{row.amount}</span>
            </div>
          ))}
        </>
      );
    case "payments": {
      const content = paymentsContent(block, doc);
      return (
        <>
          <div className="ph">
            <span className="lbl">{content.heading}</span>
          </div>
          {content.empty ? (
            <div className="pay">
              <span className="ln-muted">{content.empty}</span>
            </div>
          ) : (
            content.rows.map((row, index) => (
              <div className="pay" key={index}>
                <span>{row.left}</span>
                <span>{row.right}</span>
              </div>
            ))
          )}
        </>
      );
    }
    case "line":
    case "box":
      return null;
    default:
      return (
        <>
          {textLines(block, doc).map((line, index) => (
            <p key={index} className={`ln ln-${line.tone}`}>
              {line.text || "\u00a0"}
            </p>
          ))}
        </>
      );
  }
}

/**
 * A receipt or invoice drawn from a template: the blocks are placed by the template's CSS (stored in the database for
 * saved designs). The only inline sizes are the few blocks that moved down or grew because the order is long.
 */
export function DocumentView({ template, doc, css, editing, children, onScale }: Props) {
  const stylesheet = useMemo(() => css ?? templateToCss(template), [css, template]);
  const layout = useMemo(
    () => resolveLayout(template, editing ? { items: 0, payments: 0 } : { items: doc.snapshot.items.length, payments: doc.snapshot.payments.length }),
    [template, doc, editing],
  );

  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const update = () => setScale(Math.min(1, frame.clientWidth / PAGE_W) || 1);
    update();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);
  useEffect(() => onScale?.(scale), [scale, onScale]);

  return (
    <div className="doc-frame" ref={frameRef} style={{ height: layout.height * scale }}>
      <style>{stylesheet}</style>
      <div className="doc-scaler" style={{ width: PAGE_W, transform: `scale(${scale})` }}>
        <div className={`doc-tpl${editing ? " doc-editing" : ""}`} style={{ height: layout.height }}>
          {layout.blocks.map((rb) => (
            <div
              key={rb.block.id}
              className={`b b-${rb.block.id}`}
              style={{ top: rb.y, height: rb.h }}
              onPointerDown={editing ? (event) => editing.onBlockPointerDown(event, rb.block) : undefined}
            >
              <BlockBody block={rb.block} doc={doc} editing={Boolean(editing)} />
            </div>
          ))}
          {children}
        </div>
      </div>
    </div>
  );
}

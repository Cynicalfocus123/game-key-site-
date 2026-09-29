"use client";

import { useEffect, useRef, useState } from "react";
import { IMAGE_H, IMAGE_MAX_BYTES, IMAGE_W } from "@/lib/products";
import { assetPath } from "./cart-ui";

// Product image picker (task B, Eneba sizes). The frame is locked to 4:5: the admin can only move and zoom, so the saved file is
// always exactly 800 x 1000 and no size error can happen. Dashed lines = the 5:7 part the listing cards show.
const FW = 280; const FH = 350; // frame on screen (4:5)
const LIST_W = FH * 5 / 7; const SIDE = (FW - LIST_W) / 2; // listing card area inside the frame

type Crop = { img: HTMLImageElement; zoom: number; x: number; y: number };
const base = (img: HTMLImageElement) => Math.max(FW / img.naturalWidth, FH / img.naturalHeight);
function clamp(c: Crop): Crop {
  const w = c.img.naturalWidth * base(c.img) * c.zoom; const h = c.img.naturalHeight * base(c.img) * c.zoom;
  return { ...c, x: Math.min(0, Math.max(FW - w, c.x)), y: Math.min(0, Math.max(FH - h, c.y)) };
}
// Draws the frame at 800 x 1000. WebP when the browser can encode it (Chrome, Edge, Firefox), else JPEG (Safari).
function render(c: Crop) {
  const k = IMAGE_W / FW; const canvas = document.createElement("canvas"); canvas.width = IMAGE_W; canvas.height = IMAGE_H;
  const ctx = canvas.getContext("2d")!; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, IMAGE_W, IMAGE_H); ctx.imageSmoothingQuality = "high";
  const s = base(c.img) * c.zoom; ctx.drawImage(c.img, c.x * k, c.y * k, c.img.naturalWidth * s * k, c.img.naturalHeight * s * k);
  for (const q of [0.86, 0.75, 0.6]) {
    let url = canvas.toDataURL("image/webp", q);
    if (!url.startsWith("data:image/webp")) url = canvas.toDataURL("image/jpeg", q + 0.04);
    if (url.length * 0.75 <= IMAGE_MAX_BYTES) return url;
  }
  return null;
}

export function ImageCropper({ value, name, onUpload, invalid }: { value: string; name: string; onUpload: (dataUrl: string) => Promise<string | null>; invalid?: boolean }) {
  const [crop, setCrop] = useState<Crop | null>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const file = useRef<HTMLInputElement>(null); const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const objectUrl = useRef<string | null>(null);
  useEffect(() => () => { if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); }, []);

  const pick = (f: File | undefined) => {
    setErr(""); if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { setErr("Choose a JPG, PNG or WebP file."); return; }
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    const url = URL.createObjectURL(f); objectUrl.current = url;
    const img = new Image();
    img.onload = () => { const s = base(img); setCrop(clamp({ img, zoom: 1, x: (FW - img.naturalWidth * s) / 2, y: (FH - img.naturalHeight * s) / 2 })); };
    img.onerror = () => setErr("This file could not be opened as an image.");
    img.src = url;
  };
  const zoomTo = (z: number) => setCrop((c) => {
    if (!c) return c; const s0 = c.zoom; const cx = FW / 2 - c.x; const cy = FH / 2 - c.y; // keep the middle of the frame in place
    return clamp({ ...c, zoom: z, x: FW / 2 - cx * (z / s0), y: FH / 2 - cy * (z / s0) });
  });
  const move = (dx: number, dy: number) => setCrop((c) => (c ? clamp({ ...c, x: c.x + dx, y: c.y + dy }) : c));
  const use = async () => {
    if (!crop) return; const data = render(crop); if (!data) { setErr("The image is too detailed to save under 1.5 MB. Try a simpler image."); return; }
    setBusy(true); setErr(""); const url = await onUpload(data); setBusy(false);
    if (url) { setCrop(null); if (file.current) file.current.value = ""; }
  };
  const s = crop ? base(crop.img) * crop.zoom : 1;

  return <div className="imgc">
    <p className="imgc-rule"><strong>{IMAGE_W} × {IMAGE_H} px (4:5)</strong> · one image for the listing cards and the product page. Any photo fits: move and zoom it inside the frame.</p>
    <div className="imgc-body">
      <div className="imgc-left">
        <div className={`imgc-frame${crop ? " is-crop" : ""}${invalid && !value && !crop ? " is-invalid" : ""}`} style={{ width: FW, height: FH }}
          tabIndex={crop ? 0 : -1} role={crop ? "application" : undefined} aria-label={crop ? "Image position. Drag or use the arrow keys to move it." : undefined}
          onKeyDown={(e) => { const d = e.shiftKey ? 30 : 8; const m: Record<string, [number, number]> = { ArrowLeft: [d, 0], ArrowRight: [-d, 0], ArrowUp: [0, d], ArrowDown: [0, -d] }; if (crop && m[e.key]) { e.preventDefault(); move(...m[e.key]); } }}
          onPointerDown={(e) => { if (!crop) return; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); drag.current = { px: e.clientX, py: e.clientY, x: crop.x, y: crop.y }; }}
          onPointerMove={(e) => { const d = drag.current; if (!d) return; setCrop((c) => (c ? clamp({ ...c, x: d.x + e.clientX - d.px, y: d.y + e.clientY - d.py }) : c)); }}
          onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
          {crop ? <img src={crop.img.src} alt="" draggable={false} style={{ width: crop.img.naturalWidth * s, height: crop.img.naturalHeight * s, transform: `translate(${crop.x}px, ${crop.y}px)` }} />
            : value ? <img src={assetPath(value)} alt={`${name || "Product"} image`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <span className="imgc-empty">4:5 frame<br />{IMAGE_W} × {IMAGE_H}</span>}
          <span className="imgc-guide" style={{ left: SIDE, width: LIST_W }} aria-hidden="true" />
        </div>
        <small className="muted-note">Dashed lines: the part listing cards show (5:7).</small>
        {crop ? <div className="imgc-tools">
          <label className="imgc-zoom">Zoom<input type="range" min={1} max={4} step={0.01} value={crop.zoom} onChange={(e) => zoomTo(Number(e.target.value))} /></label>
          <div className="imgc-btns"><button type="button" className="btn btn-primary" onClick={use} disabled={busy}>{busy ? "Saving image…" : "Use this image"}</button>
            <button type="button" className="btn btn-outline" onClick={() => { setCrop(null); if (file.current) file.current.value = ""; }} disabled={busy}>Cancel</button></div>
        </div> : <div className="imgc-btns"><label className="btn btn-outline imgc-file">{value ? "Replace image" : "Choose image"}
          <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => pick(e.target.files?.[0])} /></label></div>}
        {err && <p className="field-error" role="alert">{err}</p>}
      </div>
      {value && !crop && <div className="imgc-previews" aria-label="Preview">
        <figure><div className="imgc-pv-list"><img src={assetPath(value)} alt="" /></div><figcaption>Listing card (5:7)</figcaption></figure>
        <figure><div className="imgc-pv-pdp"><img src={assetPath(value)} alt="" /></div><figcaption>Product page (4:5)</figcaption></figure>
      </div>}
    </div>
  </div>;
}

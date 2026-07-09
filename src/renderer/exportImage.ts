import { toPng, toSvg } from "html-to-image";
import { getNodesBounds, type Node } from "@xyflow/react";

export interface ExportBounds { x: number; y: number; width: number; height: number; }
export interface ExportTarget { width: number; height: number; padding: number; }
export interface ExportTransform { x: number; y: number; zoom: number; }

export function computeExportTransform(bounds: ExportBounds, target: ExportTarget): ExportTransform {
  const usableWidth = target.width * (1 - target.padding);
  const usableHeight = target.height * (1 - target.padding);
  const zoom = Math.min(usableWidth / bounds.width, usableHeight / bounds.height, 1);
  const x = target.width / 2 - (bounds.x + bounds.width / 2) * zoom;
  const y = target.height / 2 - (bounds.y + bounds.height / 2) * zoom;
  return { x, y, zoom };
}

const EXPORT_WIDTH = 2000;
const EXPORT_HEIGHT = 1400;
const EXPORT_PADDING = 0.08;

function triggerDownload(dataUrl: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = filename;
  anchor.click();
}

interface CaptureArgs { nodes: Node[]; viewport: HTMLElement; filename: string; }

function captureOptions(nodes: Node[]) {
  const bounds = getNodesBounds(nodes);
  const transform = computeExportTransform(bounds, { width: EXPORT_WIDTH, height: EXPORT_HEIGHT, padding: EXPORT_PADDING });
  return {
    width: EXPORT_WIDTH,
    height: EXPORT_HEIGHT,
    style: {
      width: `${EXPORT_WIDTH}px`,
      height: `${EXPORT_HEIGHT}px`,
      transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`
    }
  };
}

export async function exportPng({ nodes, viewport, filename }: CaptureArgs) {
  const options = captureOptions(nodes);
  const dataUrl = await toPng(viewport, { ...options, pixelRatio: 2, backgroundColor: "#ffffff" });
  triggerDownload(dataUrl, `${filename}.png`);
}

export async function exportSvg({ nodes, viewport, filename }: CaptureArgs) {
  const options = captureOptions(nodes);
  const dataUrl = await toSvg(viewport, { ...options, backgroundColor: "#ffffff" });
  triggerDownload(dataUrl, `${filename}.svg`);
}

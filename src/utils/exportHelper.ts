import { Document, Paragraph, TextRun, HeadingLevel, PageBreak, Packer } from 'docx';
import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';
import { AnnotationItem } from '../types/pdf';
import { applyAnnotationsToPdf } from './pdfHelper';

export interface ExportSettings {
  format: 'pdf' | 'docx' | 'jpg' | 'png';
  filename: string;
  pageScope: 'all' | 'current' | 'custom';
  currentPage: number;
  customPageRange?: string; // e.g. "1-3, 5"
  includeAnnotations: boolean;
  // Image specific
  imageQuality: number; // 0.1 to 1.0 (for jpg)
  imageScale: number; // 1, 1.5, 2
  // DOCX specific
  includePageBreaks: boolean;
  docxTitle?: string;
}

/**
 * Parse custom page range string like "1-3, 5, 7-8" into 1-based page numbers.
 */
export function parsePageRange(rangeStr: string, totalPages: number): number[] {
  if (!rangeStr.trim()) return Array.from({ length: totalPages }, (_, i) => i + 1);

  const pages = new Set<number>();
  const parts = rangeStr.split(/[,;\s]+/).filter(Boolean);

  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end)) {
        const min = Math.max(1, Math.min(start, end));
        const max = Math.min(totalPages, Math.max(start, end));
        for (let p = min; p <= max; p++) {
          pages.add(p);
        }
      }
    } else {
      const p = parseInt(part, 10);
      if (!isNaN(p) && p >= 1 && p <= totalPages) {
        pages.add(p);
      }
    }
  }

  const result = Array.from(pages).sort((a, b) => a - b);
  return result.length > 0 ? result : Array.from({ length: totalPages }, (_, i) => i + 1);
}

/**
 * Extract structured text from a PDF document using pdfjs-dist.
 */
export async function extractTextFromPdf(
  pdfBytes: Uint8Array,
  pageNumbers: number[]
): Promise<{ pageNumber: number; lines: string[] }[]> {
  const bytesCopy = new Uint8Array(pdfBytes);
  const loadingTask = pdfjsLib.getDocument({ data: bytesCopy });
  const pdfDoc = await loadingTask.promise;

  const results: { pageNumber: number; lines: string[] }[] = [];

  for (const pageNum of pageNumbers) {
    if (pageNum < 1 || pageNum > pdfDoc.numPages) continue;
    const page = await pdfDoc.getPage(pageNum);
    const content = await page.getTextContent();

    // Group text items by roughly the same vertical line (Y coordinate)
    interface TextItemWithPos {
      text: string;
      x: number;
      y: number;
      height: number;
    }

    const items: TextItemWithPos[] = [];
    for (const item of content.items) {
      if ('str' in item && typeof item.str === 'string' && item.str.trim()) {
        const tx = item.transform; // [scaleX, skewY, skewX, scaleY, transX, transY]
        items.push({
          text: item.str,
          x: tx[4],
          y: tx[5],
          height: item.height || Math.abs(tx[3]) || 12,
        });
      }
    }

    // Sort top to bottom (higher Y in PDF means higher on the page), then left to right
    items.sort((a, b) => {
      const yDiff = b.y - a.y;
      if (Math.abs(yDiff) > 5) return yDiff;
      return a.x - b.x;
    });

    // Merge items into lines based on Y tolerance
    const lineBuckets: string[] = [];
    let currentLine: TextItemWithPos[] = [];
    let currentY = items[0]?.y ?? 0;

    for (const item of items) {
      if (Math.abs(item.y - currentY) > 6) {
        if (currentLine.length > 0) {
          lineBuckets.push(currentLine.map((i) => i.text).join(' '));
        }
        currentLine = [item];
        currentY = item.y;
      } else {
        currentLine.push(item);
      }
    }

    if (currentLine.length > 0) {
      lineBuckets.push(currentLine.map((i) => i.text).join(' '));
    }

    results.push({
      pageNumber: pageNum,
      lines: lineBuckets,
    });
  }

  return results;
}

/**
 * Export PDF content to a Microsoft Word (.docx) document.
 */
export async function exportToDocx(
  pdfBytes: Uint8Array,
  settings: ExportSettings,
  annotationsByPage: Record<number, AnnotationItem[]> = {},
  onProgress?: (progress: number, message: string) => void
): Promise<Blob> {
  onProgress?.(10, 'Чтение структуры PDF документа...');

  const bytesCopy = new Uint8Array(pdfBytes);
  const loadingTask = pdfjsLib.getDocument({ data: bytesCopy });
  const pdfDoc = await loadingTask.promise;
  const totalPages = pdfDoc.numPages;

  let pagesToProcess: number[] = [];
  if (settings.pageScope === 'current') {
    pagesToProcess = [settings.currentPage];
  } else if (settings.pageScope === 'custom' && settings.customPageRange) {
    pagesToProcess = parsePageRange(settings.customPageRange, totalPages);
  } else {
    pagesToProcess = Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  onProgress?.(30, 'Извлечение текстового содержимого...');
  const extracted = await extractTextFromPdf(pdfBytes, pagesToProcess);

  onProgress?.(60, 'Формирование документа Word (.docx)...');

  const docxChildren: (Paragraph)[] = [];

  // Title if provided
  if (settings.docxTitle?.trim()) {
    docxChildren.push(
      new Paragraph({
        text: settings.docxTitle.trim(),
        heading: HeadingLevel.TITLE,
        spacing: { after: 300 },
      })
    );
  }

  extracted.forEach((pageData, index) => {
    // Page header
    docxChildren.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `— Страница ${pageData.pageNumber} —`,
            italics: true,
            color: '64748B',
            size: 20, // 10pt
          }),
        ],
        spacing: { before: 200, after: 120 },
      })
    );

    // Added annotations if requested
    if (settings.includeAnnotations && annotationsByPage[pageData.pageNumber]) {
      const pageAnns = annotationsByPage[pageData.pageNumber].filter(
        (a): a is Extract<AnnotationItem, { type: 'text' }> => a.type === 'text' && !!a.text.trim()
      );
      if (pageAnns.length > 0) {
        docxChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'Добавленные комментарии и текст:',
                bold: true,
                color: '2563EB',
                size: 20,
              }),
            ],
            spacing: { before: 100, after: 60 },
          })
        );

        for (const ann of pageAnns) {
          docxChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `• ${ann.text}`,
                  bold: ann.isBold,
                  italics: ann.isItalic,
                }),
              ],
              spacing: { after: 60 },
            })
          );
        }
      }
    }

    // Main text lines
    if (pageData.lines.length === 0) {
      docxChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: '[Страница не содержит распознаваемого текста или является отсканированным изображением]',
              italics: true,
              color: '94A3B8',
              size: 20,
            }),
          ],
          spacing: { after: 140 },
        })
      );
    } else {
      for (const line of pageData.lines) {
        docxChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: line,
                size: 22, // 11pt
              }),
            ],
            spacing: { after: 100 },
          })
        );
      }
    }

    // Page break between pages (except last page)
    if (settings.includePageBreaks && index < extracted.length - 1) {
      docxChildren.push(
        new Paragraph({
          children: [new PageBreak()],
        })
      );
    }
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: docxChildren,
      },
    ],
  });

  onProgress?.(90, 'Упаковка и компиляция файла DOCX...');
  const blob = await Packer.toBlob(doc);
  onProgress?.(100, 'Готово!');
  return blob;
}

/**
 * Render a page to an image blob (JPG or PNG) including annotations if requested.
 */
async function renderPageToImageBlob(
  pdfBytes: Uint8Array,
  pageNumber: number,
  format: 'jpg' | 'png',
  scale: number = 1.5,
  quality: number = 0.9,
  annotations: AnnotationItem[] = []
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const bytesCopy = new Uint8Array(pdfBytes);
  const loadingTask = pdfjsLib.getDocument({ data: bytesCopy });
  const pdfDoc = await loadingTask.promise;
  const page = await pdfDoc.getPage(pageNumber);

  const viewport = page.getViewport({ scale });
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const ctx = canvas.getContext('2d')!;

  // If exporting as JPG, ensure white background
  if (format === 'jpg') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Render the base PDF page
  await (page.render({
    canvasContext: ctx,
    viewport: viewport,
    canvas: canvas,
  } as any) as any).promise;

  // Render any user annotations on top of the canvas
  if (annotations.length > 0) {
    const pageWidth = canvas.width;
    const pageHeight = canvas.height;

    for (const ann of annotations) {
      const x = (ann.x / 100) * pageWidth;
      const y = (ann.y / 100) * pageHeight;

      if (ann.type === 'text') {
        const fontSize = ann.fontSize * (scale / 1.5) * 1.25;
        const padding = 6 * (scale / 1.5);
        ctx.font = `${ann.isItalic ? 'italic ' : ''}${ann.isBold ? 'bold ' : 'normal '}${fontSize}px sans-serif`;

        const lines = ann.text.split('\n');
        let maxLineW = 0;
        for (const line of lines) {
          const w = ctx.measureText(line).width;
          if (w > maxLineW) maxLineW = w;
        }
        const lineH = fontSize * 1.35;
        const boxW = maxLineW + padding * 2;
        const boxH = lines.length * lineH + padding * 2;

        if (ann.bgColor && ann.bgColor !== 'transparent') {
          ctx.fillStyle = ann.bgColor;
          ctx.fillRect(x, y, boxW, boxH);
        }

        ctx.fillStyle = ann.fontColor || '#000000';
        ctx.textBaseline = 'top';
        for (let i = 0; i < lines.length; i++) {
          ctx.fillText(lines[i], x + padding, y + padding + i * lineH);
        }
      } else if (ann.type === 'image') {
        const w = (ann.width / 100) * pageWidth;
        const h = (ann.height / 100) * pageHeight;
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, x, y, w, h);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = ann.dataUrl;
        });
      } else if (ann.type === 'shape') {
        const w = (ann.width / 100) * pageWidth;
        const h = (ann.height / 100) * pageHeight;
        ctx.fillStyle = ann.fillColor;
        ctx.globalAlpha = ann.opacity ?? 1;
        ctx.fillRect(x, y, w, h);
        ctx.globalAlpha = 1;
      }
    }
  }

  const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to generate image blob'));
      },
      mimeType,
      format === 'jpg' ? quality : undefined
    );
  });
}

/**
 * Export PDF to Image (JPG or PNG), single page or multiple pages packed in a ZIP.
 */
export async function exportToImages(
  pdfBytes: Uint8Array,
  settings: ExportSettings,
  annotationsByPage: Record<number, AnnotationItem[]> = {},
  onProgress?: (progress: number, message: string) => void
): Promise<{ blob: Blob; filename: string }> {
  onProgress?.(5, 'Подготовка документа к рендерингу...');

  const bytesCopy = new Uint8Array(pdfBytes);
  const loadingTask = pdfjsLib.getDocument({ data: bytesCopy });
  const pdfDoc = await loadingTask.promise;
  const totalPages = pdfDoc.numPages;

  let pagesToProcess: number[] = [];
  if (settings.pageScope === 'current') {
    pagesToProcess = [settings.currentPage];
  } else if (settings.pageScope === 'custom' && settings.customPageRange) {
    pagesToProcess = parsePageRange(settings.customPageRange, totalPages);
  } else {
    pagesToProcess = Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const baseName = settings.filename.replace(/\.[^/.]+$/, '');
  const ext = settings.format === 'jpg' ? 'jpg' : 'png';

  // Single page export -> return image directly
  if (pagesToProcess.length === 1) {
    const pageNum = pagesToProcess[0];
    onProgress?.(50, `Рендеринг страницы ${pageNum}...`);
    const pageAnns = settings.includeAnnotations ? annotationsByPage[pageNum] || [] : [];
    const blob = await renderPageToImageBlob(
      pdfBytes,
      pageNum,
      settings.format as 'jpg' | 'png',
      settings.imageScale,
      settings.imageQuality,
      pageAnns
    );
    onProgress?.(100, 'Готово!');
    return {
      blob,
      filename: `${baseName}_стр_${pageNum}.${ext}`,
    };
  }

  // Multiple pages export -> create ZIP archive
  const zip = new JSZip();
  const folder = zip.folder(baseName) || zip;

  for (let i = 0; i < pagesToProcess.length; i++) {
    const pageNum = pagesToProcess[i];
    const pct = Math.round(10 + (i / pagesToProcess.length) * 75);
    onProgress?.(pct, `Рендеринг страницы ${pageNum} из ${pagesToProcess.length}...`);

    const pageAnns = settings.includeAnnotations ? annotationsByPage[pageNum] || [] : [];
    const blob = await renderPageToImageBlob(
      pdfBytes,
      pageNum,
      settings.format as 'jpg' | 'png',
      settings.imageScale,
      settings.imageQuality,
      pageAnns
    );

    const padNum = String(pageNum).padStart(3, '0');
    folder.file(`page_${padNum}.${ext}`, blob);
  }

  onProgress?.(90, 'Создание ZIP архива...');
  const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
    onProgress?.(90 + Math.round(metadata.percent * 0.1), `Упаковка архива...`);
  });

  onProgress?.(100, 'Готово!');
  return {
    blob: zipBlob,
    filename: `${baseName}_изображения_${ext}.zip`,
  };
}

/**
 * Execute unified export based on settings.
 */
export async function executeExport(
  pdfBytes: Uint8Array,
  settings: ExportSettings,
  annotationsByPage: Record<number, AnnotationItem[]> = {},
  onProgress?: (progress: number, message: string) => void
): Promise<{ blob: Blob; filename: string }> {
  const baseName = settings.filename.replace(/\.[^/.]+$/, '');

  if (settings.format === 'pdf') {
    onProgress?.(20, 'Применение изменений и формирование PDF...');
    let finalBytes = pdfBytes;
    if (settings.includeAnnotations && Object.keys(annotationsByPage).length > 0) {
      finalBytes = await applyAnnotationsToPdf(pdfBytes, annotationsByPage);
    }
    onProgress?.(90, 'Финализация PDF документа...');
    const blob = new Blob([finalBytes as unknown as BlobPart], { type: 'application/pdf' });
    onProgress?.(100, 'Готово!');
    return {
      blob,
      filename: `${baseName}.pdf`,
    };
  }

  if (settings.format === 'docx') {
    const blob = await exportToDocx(pdfBytes, settings, annotationsByPage, onProgress);
    return {
      blob,
      filename: `${baseName}.docx`,
    };
  }

  if (settings.format === 'jpg' || settings.format === 'png') {
    return await exportToImages(pdfBytes, settings, annotationsByPage, onProgress);
  }

  throw new Error(`Unsupported export format: ${settings.format}`);
}

/**
 * Trigger download of any Blob.
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

import { PDFDocument, rgb, degrees } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { AnnotationItem, TextAnnotation, ImageAnnotation, ShapeAnnotation } from '../types/pdf';

// Setup pdf.js worker using unpkg CDN or bundled worker
if (typeof window !== 'undefined') {
  try {
    // Standard worker source matching the installed pdfjs-dist version
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  } catch (err) {
    console.warn('Could not set GlobalWorkerOptions.workerSrc:', err);
  }
}

/**
 * Render a specific page of a PDF document onto an HTML5 canvas element.
 */
export async function renderPdfPage(
  pdfBytes: Uint8Array,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number = 1.5
): Promise<{ width: number; height: number }> {
  // Create a copy of the bytes to avoid detached array buffer issues in workers
  const bytesCopy = new Uint8Array(pdfBytes);
  const loadingTask = pdfjsLib.getDocument({
    data: bytesCopy,
    cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
    cMapPacked: true,
  });

  const pdfDoc = await loadingTask.promise;
  const page = await pdfDoc.getPage(pageNumber);

  const viewport = page.getViewport({ scale });
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot get 2d context for canvas');

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const renderContext = {
    canvasContext: ctx,
    viewport: viewport,
    canvas: canvas,
  };

  await (page.render(renderContext as any) as any).promise;

  return {
    width: viewport.width,
    height: viewport.height,
  };
}

/**
 * Get total page count and dimensions of a PDF.
 */
export async function getPdfInfo(pdfBytes: Uint8Array) {
  const bytesCopy = new Uint8Array(pdfBytes);
  const loadingTask = pdfjsLib.getDocument({ data: bytesCopy });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

  const pagesInfo = [];
  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    pagesInfo.push({
      pageNumber: i,
      width: viewport.width,
      height: viewport.height,
      rotation: page.rotate || 0,
    });
  }

  return {
    pageCount: numPages,
    pages: pagesInfo,
  };
}

/**
 * Helper to render an annotation onto an offscreen canvas at high resolution
 * and return PNG bytes for crisp PDF embedding.
 */
function renderTextAnnotationToPng(
  ann: TextAnnotation,
  scaleFactor: number = 3
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    try {
      const fontSize = ann.fontSize * scaleFactor;
      const padding = 8 * scaleFactor;

      // Temporary canvas to measure text
      const measureCanvas = document.createElement('canvas');
      const mCtx = measureCanvas.getContext('2d')!;
      const fontStyle = `${ann.isItalic ? 'italic ' : ''}${ann.isBold ? 'bold ' : 'normal '}${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
      mCtx.font = fontStyle;

      const lines = ann.text.split('\n');
      let maxWidth = 0;
      for (const line of lines) {
        const metrics = mCtx.measureText(line || ' ');
        if (metrics.width > maxWidth) maxWidth = metrics.width;
      }

      const lineHeight = fontSize * 1.35;
      const contentWidth = Math.max(maxWidth + padding * 2, 20 * scaleFactor);
      const contentHeight = lines.length * lineHeight + padding * 2;

      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(contentWidth);
      canvas.height = Math.ceil(contentHeight);
      const ctx = canvas.getContext('2d')!;

      // Background
      if (ann.bgColor && ann.bgColor !== 'transparent') {
        ctx.fillStyle = ann.bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Text
      ctx.font = fontStyle;
      ctx.fillStyle = ann.fontColor || '#111827';
      ctx.textBaseline = 'top';

      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], padding, padding + i * lineHeight);
      }

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to create blob from text canvas'));
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const buffer = reader.result as ArrayBuffer;
          resolve(new Uint8Array(buffer));
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(blob);
      }, 'image/png');
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Convert a base64 or DataURL to Uint8Array
 */
function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] || dataUrl;
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Apply user annotations (text, images, shapes, signatures) onto the PDF and return modified bytes.
 */
export async function applyAnnotationsToPdf(
  originalPdfBytes: Uint8Array,
  annotationsByPage: Record<number, AnnotationItem[]>
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalPdfBytes);
  const totalPages = pdfDoc.getPageCount();

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const pageNum = pageIdx + 1;
    const annotations = annotationsByPage[pageNum];
    if (!annotations || annotations.length === 0) continue;

    const page = pdfDoc.getPage(pageIdx);
    const { width: pageWidth, height: pageHeight } = page.getSize();

    for (const ann of annotations) {
      if (ann.type === 'text') {
        // High resolution raster rendering ensures complete Unicode / Russian Cyrillic fidelity
        const pngBytes = await renderTextAnnotationToPng(ann, 3);
        const embeddedImage = await pdfDoc.embedPng(pngBytes);
        const imgDims = embeddedImage.scale(1 / 3);

        // In PDF coordinates, (0, 0) is bottom-left, while in web overlay (0,0) is top-left
        // ann.x and ann.y are in percentage of page or point coordinates
        const xPt = (ann.x / 100) * pageWidth;
        const yPtFromTop = (ann.y / 100) * pageHeight;
        const yPt = pageHeight - yPtFromTop - imgDims.height;

        page.drawImage(embeddedImage, {
          x: Math.max(0, xPt),
          y: Math.max(0, yPt),
          width: imgDims.width,
          height: imgDims.height,
        });
      } else if (ann.type === 'image') {
        const bytes = dataUrlToBytes(ann.dataUrl);
        let embeddedImage;
        if (ann.dataUrl.includes('image/jpeg') || ann.dataUrl.includes('image/jpg')) {
          try {
            embeddedImage = await pdfDoc.embedJpg(bytes);
          } catch {
            embeddedImage = await pdfDoc.embedPng(bytes);
          }
        } else {
          embeddedImage = await pdfDoc.embedPng(bytes);
        }

        const xPt = (ann.x / 100) * pageWidth;
        const yPtFromTop = (ann.y / 100) * pageHeight;
        const widthPt = (ann.width / 100) * pageWidth;
        const heightPt = (ann.height / 100) * pageHeight;
        const yPt = pageHeight - yPtFromTop - heightPt;

        page.drawImage(embeddedImage, {
          x: xPt,
          y: yPt,
          width: widthPt,
          height: heightPt,
        });
      } else if (ann.type === 'shape') {
        const xPt = (ann.x / 100) * pageWidth;
        const yPtFromTop = (ann.y / 100) * pageHeight;
        const widthPt = (ann.width / 100) * pageWidth;
        const heightPt = (ann.height / 100) * pageHeight;
        const yPt = pageHeight - yPtFromTop - heightPt;

        // Parse hex color
        const hex = ann.fillColor.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16) / 255 || 1;
        const g = parseInt(hex.substring(2, 4), 16) / 255 || 1;
        const b = parseInt(hex.substring(4, 6), 16) / 255 || 1;

        page.drawRectangle({
          x: xPt,
          y: yPt,
          width: widthPt,
          height: heightPt,
          color: rgb(r, g, b),
          opacity: ann.opacity ?? 1,
        });
      }
    }
  }

  return await pdfDoc.save();
}

/**
 * Merge multiple PDF byte arrays into a single unified PDF document.
 */
export async function mergePdfDocuments(pdfBytesArray: Uint8Array[]): Promise<Uint8Array> {
  const mergedPdf = await PDFDocument.create();

  for (const bytes of pdfBytesArray) {
    const doc = await PDFDocument.load(bytes);
    const copiedPages = await mergedPdf.copyPages(doc, doc.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  return await mergedPdf.save();
}

/**
 * Delete specified pages (0-indexed or 1-indexed) from a PDF.
 * @param pageNumbersToDelete 1-indexed page numbers
 */
export async function deletePagesFromPdf(
  pdfBytes: Uint8Array,
  pageNumbersToDelete: number[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  // Sort descending so indices don't shift when removing
  const sortedDesc = [...pageNumbersToDelete]
    .map((p) => p - 1)
    .sort((a, b) => b - a);

  for (const pageIdx of sortedDesc) {
    if (pageIdx >= 0 && pageIdx < pdfDoc.getPageCount()) {
      pdfDoc.removePage(pageIdx);
    }
  }

  return await pdfDoc.save();
}

/**
 * Extract specified pages into a new PDF document.
 * @param pageNumbersToExtract 1-indexed page numbers
 */
export async function extractPagesFromPdf(
  pdfBytes: Uint8Array,
  pageNumbersToExtract: number[]
): Promise<Uint8Array> {
  const srcDoc = await PDFDocument.load(pdfBytes);
  const newDoc = await PDFDocument.create();

  const indices = pageNumbersToExtract
    .map((p) => p - 1)
    .filter((idx) => idx >= 0 && idx < srcDoc.getPageCount());

  const copiedPages = await newDoc.copyPages(srcDoc, indices);
  copiedPages.forEach((page) => newDoc.addPage(page));

  return await newDoc.save();
}

/**
 * Reorder or rotate pages in a PDF.
 * @param newOrder 1-indexed order of pages e.g. [3, 1, 2]
 * @param rotations Record of page index to additional rotation degrees (90, 180, 270)
 */
export async function reorderAndRotatePages(
  pdfBytes: Uint8Array,
  newOrder: number[],
  rotations: Record<number, number> = {}
): Promise<Uint8Array> {
  const srcDoc = await PDFDocument.load(pdfBytes);
  const newDoc = await PDFDocument.create();

  const zeroIndexed = newOrder.map((p) => p - 1);
  const copiedPages = await newDoc.copyPages(srcDoc, zeroIndexed);

  copiedPages.forEach((page, idx) => {
    const originalPageNum = newOrder[idx];
    const addRotation = rotations[originalPageNum] || 0;
    if (addRotation !== 0) {
      const currentRotation = page.getRotation().angle;
      page.setRotation(degrees((currentRotation + addRotation) % 360));
    }
    newDoc.addPage(page);
  });

  return await newDoc.save();
}

/**
 * Rotate a single page in a PDF by 90 degrees clockwise.
 */
export async function rotateSinglePage(
  pdfBytes: Uint8Array,
  pageNumber: number,
  degreesToAdd: number = 90
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pageIdx = pageNumber - 1;
  if (pageIdx >= 0 && pageIdx < pdfDoc.getPageCount()) {
    const page = pdfDoc.getPage(pageIdx);
    const currentAngle = page.getRotation().angle;
    page.setRotation(degrees((currentAngle + degreesToAdd) % 360));
  }
  return await pdfDoc.save();
}

/**
 * Duplicate a page in a PDF.
 */
export async function duplicatePage(
  pdfBytes: Uint8Array,
  pageNumber: number
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pageIdx = pageNumber - 1;
  if (pageIdx >= 0 && pageIdx < pdfDoc.getPageCount()) {
    const [copiedPage] = await pdfDoc.copyPages(pdfDoc, [pageIdx]);
    pdfDoc.insertPage(pageIdx + 1, copiedPage);
  }
  return await pdfDoc.save();
}

/**
 * Generate a clean sample business invoice / contract PDF for immediate demonstration.
 */
export async function generateSamplePdf(): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  // Helper to render Russian text cleanly to a canvas and embed as PNG
  const createTextPng = (
    text: string,
    fontSize: number,
    color: string = '#0f172a',
    isBold: boolean = false
  ): Promise<Uint8Array> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const scale = 3;
      const fSize = fontSize * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.font = `${isBold ? 'bold ' : ''}${fSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

      const lines = text.split('\n');
      let maxW = 0;
      lines.forEach((l) => {
        const w = ctx.measureText(l).width;
        if (w > maxW) maxW = w;
      });

      const lineH = fSize * 1.35;
      canvas.width = Math.ceil(maxW + 20);
      canvas.height = Math.ceil(lines.length * lineH + 20);

      const ctx2 = canvas.getContext('2d')!;
      ctx2.font = `${isBold ? 'bold ' : ''}${fSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx2.fillStyle = color;
      ctx2.textBaseline = 'top';

      lines.forEach((l, i) => {
        ctx2.fillText(l, 10, 10 + i * lineH);
      });

      canvas.toBlob((blob) => {
        const reader = new FileReader();
        reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
        reader.readAsArrayBuffer(blob!);
      }, 'image/png');
    });
  };

  // Page 1: Документ / Счет-Договор
  const page1 = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width: p1W, height: p1H } = page1.getSize();

  // Draw background frame line
  page1.drawRectangle({
    x: 36,
    y: 36,
    width: p1W - 72,
    height: p1H - 72,
    borderColor: rgb(0.85, 0.88, 0.92),
    borderWidth: 1,
    color: rgb(0.99, 0.99, 1),
  });

  // Top header bar
  page1.drawRectangle({
    x: 36,
    y: p1H - 110,
    width: p1W - 72,
    height: 74,
    color: rgb(0.12, 0.16, 0.22),
  });

  const headerPng = await createTextPng('ДОГОВОР-СЧЕТ № 2026-ПДФ\nОказание информационных и технических услуг', 14, '#ffffff', true);
  const headerImg = await pdfDoc.embedPng(headerPng);
  page1.drawImage(headerImg, {
    x: 52,
    y: p1H - 95,
    width: headerImg.width / 3,
    height: headerImg.height / 3,
  });

  const metaPng = await createTextPng(
    'Дата составления: 20 октября 2026 г.\nЗаказчик: ООО «Инновационные Решения»\nИсполнитель: Веб-Студия «Альфа-Систем»',
    11,
    '#334155'
  );
  const metaImg = await pdfDoc.embedPng(metaPng);
  page1.drawImage(metaImg, {
    x: 52,
    y: p1H - 180,
    width: metaImg.width / 3,
    height: metaImg.height / 3,
  });

  // Table header
  page1.drawRectangle({
    x: 52,
    y: p1H - 250,
    width: p1W - 104,
    height: 28,
    color: rgb(0.93, 0.95, 0.98),
    borderColor: rgb(0.8, 0.85, 0.9),
    borderWidth: 1,
  });

  const tableHeadPng = await createTextPng('№   Наименование работ / услуг                     Кол-во    Цена, руб.    Сумма, руб.', 10, '#1e293b', true);
  const tableHeadImg = await pdfDoc.embedPng(tableHeadPng);
  page1.drawImage(tableHeadImg, {
    x: 60,
    y: p1H - 245,
    width: tableHeadImg.width / 3,
    height: tableHeadImg.height / 3,
  });

  const tableBodyPng = await createTextPng(
    '1.  Разработка интерфейса и системы документооборота   1     45 000,00     45 000,00\n' +
    '2.  Интеграция модуля PDF-редактирования и слияния   1     35 000,00     35 000,00\n' +
    '3.  Тестирование и оптимизация быстродействия          1     15 000,00     15 000,00',
    10,
    '#334155'
  );
  const tableBodyImg = await pdfDoc.embedPng(tableBodyPng);
  page1.drawImage(tableBodyImg, {
    x: 60,
    y: p1H - 330,
    width: tableBodyImg.width / 3,
    height: tableBodyImg.height / 3,
  });

  // Total summary
  page1.drawRectangle({
    x: p1W - 240,
    y: p1H - 375,
    width: 188,
    height: 32,
    color: rgb(0.96, 0.97, 0.99),
    borderColor: rgb(0.8, 0.85, 0.9),
    borderWidth: 1,
  });

  const totalPng = await createTextPng('Итого к оплате:   95 000,00 руб.', 11, '#0f172a', true);
  const totalImg = await pdfDoc.embedPng(totalPng);
  page1.drawImage(totalImg, {
    x: p1W - 230,
    y: p1H - 368,
    width: totalImg.width / 3,
    height: totalImg.height / 3,
  });

  // Signature and stamp placeholder boxes
  const signPromptPng = await createTextPng(
    'Место для вашей подписи и штампа:\n(Используйте инструменты панели для добавления подписи, штампа или текста)',
    10,
    '#64748b',
    false
  );
  const signPromptImg = await pdfDoc.embedPng(signPromptPng);
  page1.drawImage(signPromptImg, {
    x: 52,
    y: 110,
    width: signPromptImg.width / 3,
    height: signPromptImg.height / 3,
  });

  // Stamp zone dashed box
  page1.drawRectangle({
    x: 52,
    y: 52,
    width: 200,
    height: 50,
    borderColor: rgb(0.7, 0.75, 0.8),
    borderWidth: 1,
    color: rgb(0.98, 0.98, 0.99),
  });

  const mPPng = await createTextPng('М.П. / Подпись Исполнителя', 9, '#94a3b8');
  const mPImg = await pdfDoc.embedPng(mPPng);
  page1.drawImage(mPImg, {
    x: 62,
    y: 65,
    width: mPImg.width / 3,
    height: mPImg.height / 3,
  });

  // Page 2: Приложение к договору / Акт приема
  const page2 = pdfDoc.addPage([595.28, 841.89]);
  const { width: p2W, height: p2H } = page2.getSize();

  page2.drawRectangle({
    x: 36,
    y: 36,
    width: p2W - 72,
    height: p2H - 72,
    borderColor: rgb(0.85, 0.88, 0.92),
    borderWidth: 1,
    color: rgb(0.99, 0.99, 1),
  });

  page2.drawRectangle({
    x: 36,
    y: p2H - 110,
    width: p2W - 72,
    height: 74,
    color: rgb(0.18, 0.24, 0.32),
  });

  const page2HeadPng = await createTextPng('ПРИЛОЖЕНИЕ № 1 К ДОГОВОРУ-СЧЕТУ\nАкт сдачи-приемки выполненных работ', 14, '#ffffff', true);
  const page2HeadImg = await pdfDoc.embedPng(page2HeadPng);
  page2.drawImage(page2HeadImg, {
    x: 52,
    y: p2H - 95,
    width: page2HeadImg.width / 3,
    height: page2HeadImg.height / 3,
  });

  const textActPng = await createTextPng(
    'Мы, нижеподписавшиеся, подтверждаем, что работы выполнены в полном объеме,\n' +
    'в установленные сроки и с надлежащим качеством. Претензий стороны друг к другу не имеют.\n\n' +
    '• Вы можете протестировать удаление этой страницы в режиме «Страницы».\n' +
    '• Или отделить ее в отдельный PDF-файл нажатием «Извлечь».\n' +
    '• Либо добавить на нее отметку, штамп или свой комментарий прямо сейчас.',
    11,
    '#334155'
  );
  const textActImg = await pdfDoc.embedPng(textActPng);
  page2.drawImage(textActImg, {
    x: 52,
    y: p2H - 240,
    width: textActImg.width / 3,
    height: textActImg.height / 3,
  });

  return await pdfDoc.save();
}

/**
 * Trigger browser file download from Uint8Array.
 */
export function downloadPdfBytes(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

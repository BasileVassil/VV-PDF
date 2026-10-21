import React, { useState, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { ActiveTab, AnnotationItem } from './types/pdf';
import { Header } from './components/Header';
import { EditorView } from './components/EditorView';
import { PageManagerView } from './components/PageManagerView';
import { MergeView } from './components/MergeView';
import { ExportModal } from './components/ExportModal';
import { InstallAppModal } from './components/InstallAppModal';
import {
  generateSamplePdf,
  rotateSinglePage,
  applyAnnotationsToPdf,
  downloadPdfBytes,
} from './utils/pdfHelper';
import {
  FileText,
  Upload,
  Sparkles,
  Layers,
  Merge,
  Scissors,
  CheckCircle2,
} from 'lucide-react';

export default function App() {
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState<string>('Договор_Счет_2026.pdf');
  const [totalPages, setTotalPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<ActiveTab>('editor');
  const [annotationsByPage, setAnnotationsByPage] = useState<Record<number, AnnotationItem[]>>({});
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load sample demo document on initial mount
  useEffect(() => {
    loadSampleDoc();
  }, []);

  const loadSampleDoc = async () => {
    setIsLoading(true);
    try {
      const sample = await generateSamplePdf();
      setPdfBytes(sample);
      setFileName('Образец_Договор_Счет.pdf');
      const bytesCopy = new Uint8Array(sample);
      const loadingTask = pdfjsLib.getDocument({ data: bytesCopy });
      const doc = await loadingTask.promise;
      setTotalPages(doc.numPages);
      setCurrentPage(1);
      setAnnotationsByPage({});
    } catch (err) {
      console.error('Error generating sample doc:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadFile = async (file: File) => {
    setIsLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      setPdfBytes(bytes);
      setFileName(file.name);

      const bytesCopy = new Uint8Array(bytes);
      const loadingTask = pdfjsLib.getDocument({ data: bytesCopy });
      const doc = await loadingTask.promise;
      setTotalPages(doc.numPages);
      setCurrentPage(1);
      setAnnotationsByPage({});
    } catch (err) {
      console.error('Error loading uploaded file:', err);
      alert('Не удалось загрузить PDF-файл. Убедитесь, что файл не поврежден и не защищен паролем.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePdfBytesChange = (newBytes: Uint8Array, newTotalPages: number) => {
    setPdfBytes(newBytes);
    setTotalPages(newTotalPages);
    if (currentPage > newTotalPages) {
      setCurrentPage(Math.max(1, newTotalPages));
    }
  };

  const handleRotateCurrentPage = async () => {
    if (!pdfBytes) return;
    try {
      const newBytes = await rotateSinglePage(pdfBytes, currentPage, 90);
      setPdfBytes(newBytes);
    } catch (err) {
      console.error('Error rotating page:', err);
    }
  };

  const handleQuickDownloadPdf = async () => {
    if (!pdfBytes) return;
    try {
      let finalBytes = pdfBytes;
      if (Object.keys(annotationsByPage).length > 0) {
        finalBytes = await applyAnnotationsToPdf(pdfBytes, annotationsByPage);
      }
      const baseName = fileName.replace(/\.[^/.]+$/, '');
      downloadPdfBytes(finalBytes, `${baseName}_отредактирован.pdf`);
    } catch (err) {
      console.error('Error saving PDF:', err);
      alert('Ошибка при сохранении PDF');
    }
  };

  const handleOpenPageInEditor = (pageNum: number) => {
    setCurrentPage(pageNum);
    setActiveTab('editor');
  };

  const handleLoadMergedPdf = async (mergedBytes: Uint8Array, name: string) => {
    setPdfBytes(mergedBytes);
    setFileName(name);
    const bytesCopy = new Uint8Array(mergedBytes);
    const loadingTask = pdfjsLib.getDocument({ data: bytesCopy });
    const doc = await loadingTask.promise;
    setTotalPages(doc.numPages);
    setCurrentPage(1);
    setAnnotationsByPage({});
    setActiveTab('editor');
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-neutral-950 text-neutral-100 overflow-hidden font-sans">
      {/* Top Navigation Bar */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onOpenInstallModal={() => setIsInstallModalOpen(true)}
        onQuickDownloadPdf={handleQuickDownloadPdf}
        onLoadSample={loadSampleDoc}
        onUploadNewFile={handleUploadFile}
        hasDocument={!!pdfBytes}
        pageCount={totalPages}
        fileName={fileName}
      />

      {/* Main View Area */}
      <main className="flex-1 flex overflow-hidden relative">
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-neutral-950">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-neutral-400">Загрузка и подготовка PDF документа...</span>
          </div>
        ) : !pdfBytes ? (
          /* Empty state / drop area */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-neutral-950">
            <div className="max-w-md flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shadow-lg">
                <FileText className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Редактор и Организатор PDF</h2>
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                  Добавляйте текст, картинки, штампы и подписи, объединяйте файлы, меняйте порядок, удаляйте или извлекайте страницы.
                </p>
              </div>

              <div className="flex items-center gap-3 mt-2">
                <button
                  type="button"
                  onClick={loadSampleDoc}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-md transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Попробовать образец</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'editor' && (
              <EditorView
                pdfBytes={pdfBytes}
                totalPages={totalPages}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                annotationsByPage={annotationsByPage}
                setAnnotationsByPage={setAnnotationsByPage}
                onRotateCurrentPage={handleRotateCurrentPage}
              />
            )}

            {activeTab === 'pages' && (
              <PageManagerView
                pdfBytes={pdfBytes}
                totalPages={totalPages}
                onPdfBytesChange={handlePdfBytesChange}
                onOpenPageInEditor={handleOpenPageInEditor}
                filename={fileName}
              />
            )}

            {activeTab === 'merge' && (
              <MergeView
                currentPdfBytes={pdfBytes}
                currentFilename={fileName}
                onLoadMergedPdf={handleLoadMergedPdf}
              />
            )}
          </>
        )}
      </main>

      {/* Export Modal with DOCX, JPG, PNG, PDF options */}
      {pdfBytes && (
        <ExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          pdfBytes={pdfBytes}
          totalPages={totalPages}
          currentPage={currentPage}
          annotationsByPage={annotationsByPage}
          currentFilename={fileName}
        />
      )}

      {/* Install and Download App Modal */}
      <InstallAppModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
      />
    </div>
  );
}

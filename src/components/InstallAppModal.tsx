import React, { useState } from 'react';
import {
  X,
  Download,
  Laptop,
  Smartphone,
  FolderArchive,
  ExternalLink,
  Check,
  Copy,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import JSZip from 'jszip';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { downloadBlob } from '../utils/exportHelper';

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [copied, setCopied] = useState(false);
  const [isPackaging, setIsPackaging] = useState(false);

  if (!isOpen) return null;

  const appUrl = window.location.href;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(appUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTriggerInstall = async () => {
    if (isInstallable) {
      await install();
    }
  };

  // Generate lightweight ZIP containing project README and instructions
  const handleDownloadProjectZip = async () => {
    setIsPackaging(true);
    try {
      const zip = new JSZip();
      
      const readmeContent = `# PDF Мастер — Редактор и Менеджер PDF

Полнофункциональный веб-редактор PDF с поддержкой:
- Добавления текста (с русской кириллицей, шрифтами, цветами)
- Добавления изображений, логотипов и печатей
- Рисования цифровой подписи от руки
- Штампов в 1 клик (Одобрено, Оплачено, Копия верна, Конфиденциально)
- Скрытия конфиденциальных данных белой замазкой
- Объединения нескольких PDF документов в единый файл
- Удаления, дублирования, поворота и извлечения (отделения) страниц
- Экспорта в DOCX (Word), JPG (с настройкой качества), PNG и PDF

## Запуск приложения локально на компьютере:
1. Убедитесь, что установлен Node.js (версия 18+ или 20+)
2. Откройте папку проекта в терминале
3. Выполните команду установки:
   npm install
4. Запустите приложение в режиме разработки:
   npm run dev
5. Откройте в браузере: http://localhost:3000

## Установка как десктопное приложение:
Откройте приложение в Chrome, Edge или Яндекс Браузере и нажмите значок «Установить» в адресной строке браузера.
`;

      zip.file('README.md', readmeContent);
      zip.file(
        'quick-start.txt',
        `PDF Мастер доступен онлайн по адресу:\n${appUrl}\n\nВы можете добавить эту страницу в закладки или установить на рабочий стол как приложение (PWA).`
      );

      const blob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(blob, 'pdf-master-app.zip');
    } catch (err) {
      console.error(err);
    } finally {
      setIsPackaging(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-neutral-100">
                Как установить и скачать приложение
              </h3>
              <p className="text-xs text-neutral-400">
                Доступно для ПК (Windows/macOS), смартфонов (Android/iOS) и локального запуска
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-200 transition-colors p-1.5 rounded-lg hover:bg-neutral-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex flex-col gap-6 text-sm">
          {/* Method 1: Install to PC / Desktop (PWA) */}
          <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/5 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5 text-blue-400 font-semibold text-sm">
                <Laptop className="w-5 h-5" />
                <span>Способ 1. Установить на компьютер (Windows / macOS / Linux)</span>
              </div>
              <span className="text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                Рекомендуется
              </span>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed">
              Приложение работает как полноценная настольная программа (PWA) в отдельном окне без лишних рамок браузера, с ярлыком на рабочем столе и в панели задач.
            </p>

            <div className="bg-neutral-950/70 p-3 rounded-lg border border-neutral-800 flex flex-col gap-2 text-xs text-neutral-300">
              <div className="flex items-start gap-2">
                <span className="font-semibold text-blue-400 shrink-0">В Chrome / Edge:</span>
                <span>
                  Нажмите на значок <strong className="text-white">«Установить приложение»</strong> (монитор со стрелкой вниз ⬇) в правой части адресной строки браузера.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-semibold text-blue-400 shrink-0">Через меню:</span>
                <span>
                  Или нажмите меню браузера (три точки <strong>⋮</strong> в правом верхнем углу) → <strong>«Сохранить и поделиться»</strong> → <strong>«Установить приложение PDF Мастер»</strong>.
                </span>
              </div>
            </div>

            {isInstallable && (
              <button
                type="button"
                onClick={handleTriggerInstall}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-sm transition-colors mt-1"
              >
                <Download className="w-4 h-4" />
                <span>Установить прямо сейчас</span>
              </button>
            )}

            {isInstalled && (
              <div className="flex items-center gap-2 text-xs text-emerald-400 mt-1">
                <Check className="w-4 h-4" />
                <span>Приложение уже установлено на этом устройстве!</span>
              </div>
            )}
          </div>

          {/* Method 2: Mobile Phones (Android / iPhone) */}
          <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-950/60 flex flex-col gap-3">
            <div className="flex items-center gap-2.5 text-neutral-200 font-semibold text-sm">
              <Smartphone className="w-5 h-5 text-emerald-400" />
              <span>Способ 2. Установить на телефон или планшет (Android / iPhone)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-neutral-300">
              <div className="p-3 rounded-lg bg-neutral-900 border border-neutral-800">
                <p className="font-semibold text-neutral-100 mb-1">На iPhone / iPad (Safari):</p>
                <ol className="list-decimal list-inside space-y-1 text-neutral-400">
                  <li>Нажмите кнопку «Поделиться» (квадрат со стрелкой вверх).</li>
                  <li>Прокрутите вниз и выберите «На экран “Домой”».</li>
                  <li>Нажмите «Добавить».</li>
                </ol>
              </div>

              <div className="p-3 rounded-lg bg-neutral-900 border border-neutral-800">
                <p className="font-semibold text-neutral-100 mb-1">На Android (Chrome / Яндекс):</p>
                <ol className="list-decimal list-inside space-y-1 text-neutral-400">
                  <li>Нажмите на три точки меню в браузере.</li>
                  <li>Выберите «Установить приложение» или «Добавить на гл. экран».</li>
                  <li>Подтвердите установку.</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Method 3: Direct Link & AI Studio Export */}
          <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-950/60 flex flex-col gap-3">
            <div className="flex items-center gap-2.5 text-neutral-200 font-semibold text-sm">
              <Zap className="w-5 h-5 text-amber-400" />
              <span>Способ 3. Прямая ссылка и экспорт из Google AI Studio</span>
            </div>

            <p className="text-xs text-neutral-300">
              Приложение всегда доступно в облаке. Вы можете скопировать постоянную ссылку, добавить её в закладки или открыть с любого устройства:
            </p>

            <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-lg p-2">
              <input
                type="text"
                readOnly
                value={appUrl}
                className="bg-transparent text-neutral-300 text-xs w-full focus:outline-hidden font-mono px-1"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-neutral-800 hover:bg-neutral-700 rounded-md shrink-0 border border-neutral-700 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Скопировано!' : 'Копировать'}</span>
              </button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-neutral-800/80">
              <span className="text-xs text-neutral-400">
                Скачать пакет быстрого старта с инструкцией:
              </span>
              <button
                type="button"
                onClick={handleDownloadProjectZip}
                disabled={isPackaging}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg border border-neutral-700 transition-colors"
              >
                <FolderArchive className="w-3.5 h-3.5 text-amber-400" />
                <span>{isPackaging ? 'Подготовка...' : 'Скачать ZIP'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 bg-neutral-950/80 border-t border-neutral-800 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

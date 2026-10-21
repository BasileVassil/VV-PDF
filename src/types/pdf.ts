export interface TextAnnotation {
  id: string;
  type: 'text';
  x: number; // percentage (0 to 100) or points relative to page
  y: number;
  text: string;
  fontSize: number;
  fontColor: string;
  bgColor?: string; // e.g. transparent, white (whiteout), or yellow highlight
  isBold?: boolean;
  isItalic?: boolean;
}

export interface ImageAnnotation {
  id: string;
  type: 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  dataUrl: string; // Base64 data URL
  originalWidth: number;
  originalHeight: number;
  label?: string;
}

export interface ShapeAnnotation {
  id: string;
  type: 'shape';
  x: number;
  y: number;
  width: number;
  height: number;
  fillColor: string; // e.g. '#ffffff' for whiteout, '#fef08a' for highlight
  borderColor?: string;
  opacity: number;
}

export type AnnotationItem = TextAnnotation | ImageAnnotation | ShapeAnnotation;

export interface PageInfo {
  pageNumber: number; // 1-indexed
  width: number;
  height: number;
  rotation: number; // 0, 90, 180, 270
}

export interface MergeFileItem {
  id: string;
  name: string;
  size: number;
  pageCount: number;
  data: Uint8Array;
  previewUrl?: string;
}

export type ActiveTab = 'editor' | 'pages' | 'merge';

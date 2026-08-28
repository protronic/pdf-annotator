/**
 * pdf.js 6.x splits the library into the core build and the viewer
 * components; the components no longer import the core themselves but read
 * it from `globalThis.pdfjsLib` at module-evaluation time. This module must
 * therefore be imported before `pdfjs-dist/legacy/web/pdf_viewer.mjs`.
 */
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// Plain assignment (not ??=): another extension may have parked a different
// pdf.js copy there, and our components must bind to exactly this build or
// they throw a version-mismatch error.
(globalThis as {pdfjsLib?: unknown}).pdfjsLib = pdfjsLib;

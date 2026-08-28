/**
 * Minimal signature manager for the pdf.js signature editor.
 *
 * pdfjs-dist ships the SignatureEditor (annotation editor type 101) in the
 * core build, but the dialog that captures the signature (type / draw /
 * image) lives in the full viewer and is not part of the npm package. This
 * class implements the interface the editor and the AnnotationEditorUIManager
 * call on `PDFViewer`'s `signatureManager` option, derived from the pdf.js
 * call sites: getSignature, renderEditButton, loadSignatures and destroy.
 *
 * Flow: switching the editor mode to SIGNATURE creates a hidden pending
 * editor which calls `uiManager.getSignature(editor)`. The dialog captures
 * the signature and hands it back via `editor.getFromText` /
 * `editor.getDrawnSignature` / `editor.getFromImage` + `editor.addSignature`.
 * When the dialog is dismissed the pending editor is removed again.
 */

type SignatureData = unknown;

type SignatureEditorLike = {
  /** null while the editor is a pending placeholder without a drawing. */
  _drawId: unknown;
  remove: () => void;
  addSignature: (
    data: SignatureData,
    heightInPage: number,
    description: string,
    uuid: string | null,
  ) => void;
  getFromText: (
    text: string,
    style: {fontFamily: string; fontStyle: string; fontWeight: string},
  ) => SignatureData | null;
  getFromImage: (bitmap: ImageBitmap) => SignatureData | null;
  getDrawnSignature: (lines: {
    curves: Array<{points: number[]}>;
    thickness: number;
    width: number;
    height: number;
  }) => SignatureData | null;
};

type UiManagerLike = {
  addEditListeners?: () => void;
  removeEditListeners?: () => void;
};

type SignatureManagerOptions = {
  /** Positioned host element the dialog is appended to. */
  container: HTMLElement;
  /** Called after a signature was placed (schedules the OpenCloud commit). */
  onAdded: () => void;
};

// Matches the pdf.js viewer's DEFAULT_HEIGHT_IN_PAGE (page units).
const HEIGHT_IN_PAGE = 40;
const DRAW_WIDTH = 560;
const DRAW_HEIGHT = 180;
const DRAW_THICKNESS = 2;

type Tab = 'type' | 'draw' | 'image';

export class PdfSignatureManager {
  #container: HTMLElement;
  #onAdded: () => void;
  #backdrop: HTMLElement | null = null;
  #typeInput: HTMLInputElement | null = null;
  #descriptionInput: HTMLInputElement | null = null;
  #fileInput: HTMLInputElement | null = null;
  #fileHint: HTMLElement | null = null;
  #canvas: HTMLCanvasElement | null = null;
  #addButton: HTMLButtonElement | null = null;
  #errorHint: HTMLElement | null = null;
  #tabButtons = new Map<Tab, HTMLButtonElement>();
  #panels = new Map<Tab, HTMLElement>();
  #tab: Tab = 'type';
  #curves: Array<{points: number[]}> = [];
  #currentStroke: number[] | null = null;
  #bitmap: ImageBitmap | null = null;
  #editor: SignatureEditorLike | null = null;
  #uiManager: UiManagerLike | null = null;

  constructor({container, onAdded}: SignatureManagerOptions) {
    this.#container = container;
    this.#onAdded = onAdded;
  }

  /** Entry point called by the AnnotationEditorUIManager. */
  getSignature({editor, uiManager}: {editor: unknown; uiManager?: unknown}): void {
    this.#editor = editor as SignatureEditorLike;
    this.#uiManager = (uiManager as UiManagerLike) ?? null;
    this.#uiManager?.removeEditListeners?.();
    this.#ensureDialog();
    this.#resetDialog();
    this.#backdrop!.classList.remove('hidden');
    this.#typeInput!.focus();
  }

  /** Edit-toolbar button of a placed signature (edits the description). */
  renderEditButton(editor: unknown): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'basic';
    button.title = 'Beschreibung bearbeiten';
    button.textContent = '✎';
    button.addEventListener('click', () => {
      const target = editor as {description?: string};
      const next = window.prompt('Beschreibung der Unterschrift', target.description ?? '');
      if (next !== null) {
        target.description = next;
        this.#onAdded();
      }
    });
    return button;
  }

  /** Saved-signatures storage is not implemented; nothing to preload. */
  loadSignatures(): void {}

  destroy(): void {
    this.#bitmap?.close();
    this.#bitmap = null;
    this.#backdrop?.remove();
    this.#backdrop = null;
    this.#typeInput = null;
    this.#descriptionInput = null;
    this.#fileInput = null;
    this.#fileHint = null;
    this.#canvas = null;
    this.#addButton = null;
    this.#errorHint = null;
    this.#tabButtons.clear();
    this.#panels.clear();
    this.#editor = null;
    this.#uiManager = null;
  }

  #resetDialog(): void {
    this.#tab = 'type';
    this.#typeInput!.value = '';
    this.#descriptionInput!.value = '';
    this.#fileInput!.value = '';
    this.#fileHint!.textContent = 'PNG oder JPEG mit dunkler Schrift auf hellem Grund.';
    this.#errorHint!.textContent = '';
    this.#bitmap?.close();
    this.#bitmap = null;
    this.#curves = [];
    this.#currentStroke = null;
    this.#clearCanvas();
    this.#selectTab('type');
    this.#updateAddState();
  }

  #close(added: boolean): void {
    this.#backdrop?.classList.add('hidden');
    const editor = this.#editor;
    this.#editor = null;
    if (!added && editor && editor._drawId === null) {
      // Dismissed: drop the pending placeholder editor again.
      editor.remove();
    }
    this.#uiManager?.addEditListeners?.();
    this.#uiManager = null;
  }

  #add(): void {
    const editor = this.#editor;
    if (!editor) return;
    let data: SignatureData | null = null;
    try {
      if (this.#tab === 'type') {
        const text = this.#typeInput!.value.trim();
        if (text) {
          const style = window.getComputedStyle(this.#typeInput!);
          data = editor.getFromText(text, style as unknown as Parameters<
            SignatureEditorLike['getFromText']
          >[1]);
        }
      } else if (this.#tab === 'draw' && this.#curves.length) {
        data = editor.getDrawnSignature({
          curves: this.#curves,
          thickness: DRAW_THICKNESS,
          width: DRAW_WIDTH,
          height: DRAW_HEIGHT,
        });
      } else if (this.#tab === 'image' && this.#bitmap) {
        data = editor.getFromImage(this.#bitmap);
      }
    } catch (error) {
      console.error('pdf-annotator: Signatur konnte nicht erzeugt werden', error);
    }
    if (!data) {
      this.#errorHint!.textContent =
        'Aus der Eingabe konnte keine Unterschrift erzeugt werden.';
      return;
    }
    const description =
      this.#descriptionInput!.value.trim() ||
      (this.#tab === 'type' ? this.#typeInput!.value.trim() : 'Unterschrift');
    editor.addSignature(data, HEIGHT_IN_PAGE, description, null);
    this.#close(true);
    this.#onAdded();
  }

  #selectTab(tab: Tab): void {
    this.#tab = tab;
    for (const [name, button] of this.#tabButtons) {
      button.classList.toggle('active', name === tab);
    }
    for (const [name, panel] of this.#panels) {
      panel.classList.toggle('hidden', name !== tab);
    }
    this.#errorHint!.textContent = '';
    this.#updateAddState();
  }

  #updateAddState(): void {
    if (!this.#addButton) return;
    const ready =
      (this.#tab === 'type' && !!this.#typeInput?.value.trim()) ||
      (this.#tab === 'draw' && this.#curves.length > 0) ||
      (this.#tab === 'image' && !!this.#bitmap);
    this.#addButton.disabled = !ready;
  }

  #clearCanvas(): void {
    const ctx = this.#canvas?.getContext('2d');
    if (!ctx || !this.#canvas) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, this.#canvas.width, this.#canvas.height);
  }

  #handleFile(file: File | undefined): void {
    this.#bitmap?.close();
    this.#bitmap = null;
    if (!file) {
      this.#updateAddState();
      return;
    }
    createImageBitmap(file)
      .then((bitmap) => {
        this.#bitmap = bitmap;
        this.#fileHint!.textContent = `${file.name} (${bitmap.width} × ${bitmap.height})`;
        this.#errorHint!.textContent = '';
      })
      .catch(() => {
        this.#errorHint!.textContent = 'Das Bild konnte nicht gelesen werden.';
      })
      .finally(() => this.#updateAddState());
  }

  #ensureDialog(): void {
    if (this.#backdrop) return;

    const backdrop = document.createElement('div');
    backdrop.className = 'pdfa-comment-backdrop pdfa-sign-backdrop hidden';
    backdrop.addEventListener('pointerdown', (event) => {
      if (event.target === backdrop) this.#close(false);
    });

    const dialog = document.createElement('div');
    dialog.className = 'pdfa-comment-dialog pdfa-sign-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-label', 'Unterschrift hinzufügen');

    const title = document.createElement('div');
    title.className = 'pdfa-sign-title';
    title.textContent = 'Unterschrift hinzufügen';

    const tabs = document.createElement('div');
    tabs.className = 'pdfa-sign-tabs';
    const tabDefs: Array<[Tab, string]> = [
      ['type', 'Tippen'],
      ['draw', 'Zeichnen'],
      ['image', 'Bild'],
    ];
    for (const [tab, label] of tabDefs) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `pdfa-sign-tab pdfa-sign-tab-${tab}`;
      button.textContent = label;
      button.addEventListener('click', () => this.#selectTab(tab));
      this.#tabButtons.set(tab, button);
      tabs.append(button);
    }

    // Tab: type.
    const typePanel = document.createElement('div');
    typePanel.className = 'pdfa-sign-panel';
    const typeInput = document.createElement('input');
    typeInput.type = 'text';
    typeInput.className = 'pdfa-sign-type-input';
    typeInput.placeholder = 'Unterschrift eingeben';
    typeInput.addEventListener('input', () => this.#updateAddState());
    typeInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') this.#add();
      else if (event.key === 'Escape') this.#close(false);
    });
    typePanel.append(typeInput);
    this.#panels.set('type', typePanel);

    // Tab: draw.
    const drawPanel = document.createElement('div');
    drawPanel.className = 'pdfa-sign-panel hidden';
    const canvas = document.createElement('canvas');
    canvas.className = 'pdfa-sign-canvas';
    canvas.width = DRAW_WIDTH;
    canvas.height = DRAW_HEIGHT;
    const ctx = canvas.getContext('2d')!;
    const canvasPoint = (event: PointerEvent): [number, number] => {
      const rect = canvas.getBoundingClientRect();
      return [
        ((event.clientX - rect.left) / rect.width) * DRAW_WIDTH,
        ((event.clientY - rect.top) / rect.height) * DRAW_HEIGHT,
      ];
    };
    canvas.addEventListener('pointerdown', (event) => {
      canvas.setPointerCapture(event.pointerId);
      const [x, y] = canvasPoint(event);
      this.#currentStroke = [x, y];
      event.preventDefault();
    });
    canvas.addEventListener('pointermove', (event) => {
      const stroke = this.#currentStroke;
      if (!stroke) return;
      const [x, y] = canvasPoint(event);
      const [prevX, prevY] = [stroke[stroke.length - 2]!, stroke[stroke.length - 1]!];
      stroke.push(x, y);
      ctx.strokeStyle = '#1a1a1e';
      ctx.lineWidth = DRAW_THICKNESS;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(prevX, prevY);
      ctx.lineTo(x, y);
      ctx.stroke();
    });
    const endStroke = () => {
      if (this.#currentStroke && this.#currentStroke.length >= 2) {
        this.#curves.push({points: this.#currentStroke});
      }
      this.#currentStroke = null;
      this.#updateAddState();
    };
    canvas.addEventListener('pointerup', endStroke);
    canvas.addEventListener('pointercancel', endStroke);
    const clearButton = document.createElement('button');
    clearButton.type = 'button';
    clearButton.className = 'pdfa-sign-clear';
    clearButton.textContent = 'Leeren';
    clearButton.addEventListener('click', () => {
      this.#curves = [];
      this.#currentStroke = null;
      this.#clearCanvas();
      this.#updateAddState();
    });
    drawPanel.append(canvas, clearButton);
    this.#panels.set('draw', drawPanel);

    // Tab: image.
    const imagePanel = document.createElement('div');
    imagePanel.className = 'pdfa-sign-panel hidden';
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.className = 'pdfa-sign-file';
    fileInput.addEventListener('change', () => this.#handleFile(fileInput.files?.[0]));
    const fileHint = document.createElement('p');
    fileHint.className = 'pdfa-sign-hint';
    imagePanel.append(fileInput, fileHint);
    this.#panels.set('image', imagePanel);

    const descriptionLabel = document.createElement('label');
    descriptionLabel.className = 'pdfa-sign-description-label';
    descriptionLabel.textContent = 'Beschreibung (Alternativtext)';
    const descriptionInput = document.createElement('input');
    descriptionInput.type = 'text';
    descriptionInput.className = 'pdfa-sign-description';
    descriptionLabel.append(descriptionInput);

    const errorHint = document.createElement('p');
    errorHint.className = 'pdfa-sign-error';

    const actions = document.createElement('div');
    actions.className = 'pdfa-comment-actions';
    const spacer = document.createElement('span');
    spacer.className = 'pdfa-comment-spacer';
    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'pdfa-comment-cancel pdfa-sign-cancel';
    cancelButton.textContent = 'Abbrechen';
    cancelButton.addEventListener('click', () => this.#close(false));
    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'pdfa-comment-save pdfa-sign-add';
    addButton.textContent = 'Hinzufügen';
    addButton.addEventListener('click', () => this.#add());
    actions.append(spacer, cancelButton, addButton);

    dialog.append(title, tabs, typePanel, drawPanel, imagePanel, descriptionLabel, errorHint, actions);
    backdrop.append(dialog);
    this.#container.append(backdrop);

    this.#backdrop = backdrop;
    this.#typeInput = typeInput;
    this.#descriptionInput = descriptionInput;
    this.#fileInput = fileInput;
    this.#fileHint = fileHint;
    this.#canvas = canvas;
    this.#addButton = addButton;
    this.#errorHint = errorHint;
    this.#clearCanvas();
  }
}

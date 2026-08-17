<template>
  <div class="pdf-annotator" :style="iconVars">
    <header class="toolbar">
      <div class="toolbar-group">
        <button
          type="button"
          class="tb-btn"
          :class="{toggled: outlineOpen}"
          title="Dokumentstruktur"
          aria-label="Dokumentstruktur"
          :disabled="!pdfLoaded"
          @click="outlineOpen = !outlineOpen"
        >
          <span class="tb-icon icon-outline" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="tb-btn"
          :class="{toggled: findOpen}"
          title="Suchen"
          aria-label="Suchen"
          :disabled="!pdfLoaded"
          @click="toggleFind"
        >
          <span class="tb-icon icon-search" aria-hidden="true" />
        </button>
      </div>

      <span class="separator" aria-hidden="true" />

      <div class="toolbar-group" aria-label="Seitennavigation">
        <button
          type="button"
          class="tb-btn"
          title="Vorherige Seite"
          aria-label="Vorherige Seite"
          :disabled="!pdfLoaded || currentPage <= 1"
          @click="goPage(-1)"
        >
          <span class="tb-icon icon-page-up" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="tb-btn"
          title="Nächste Seite"
          aria-label="Nächste Seite"
          :disabled="!pdfLoaded || currentPage >= pageCount"
          @click="goPage(1)"
        >
          <span class="tb-icon icon-page-down" aria-hidden="true" />
        </button>
        <input
          v-model="pageInputValue"
          class="page-input"
          type="text"
          inputmode="numeric"
          title="Seite"
          aria-label="Seite"
          :disabled="!pdfLoaded"
          @change="onPageSubmit"
          @keydown.enter="onPageSubmit"
        />
        <span class="page-count">von {{ pageCount }}</span>
      </div>

      <span class="spacer" />

      <div class="toolbar-group" aria-label="Zoom">
        <button
          type="button"
          class="tb-btn"
          title="Verkleinern"
          aria-label="Verkleinern"
          :disabled="!pdfLoaded"
          @click="zoomOut"
        >
          <span class="tb-icon icon-zoom-out" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="tb-btn"
          title="Vergrößern"
          aria-label="Vergrößern"
          :disabled="!pdfLoaded"
          @click="zoomIn"
        >
          <span class="tb-icon icon-zoom-in" aria-hidden="true" />
        </button>
        <select
          v-model="zoomSelect"
          class="zoom-select"
          title="Zoom"
          aria-label="Zoom"
          :disabled="!pdfLoaded"
          @change="onZoomSelect"
        >
          <option v-if="zoomSelect === 'custom'" value="custom">{{ customZoomLabel }}</option>
          <option v-for="preset in zoomPresets" :key="preset.value" :value="preset.value">
            {{ preset.label }}
          </option>
        </select>
      </div>

      <span class="spacer" />

      <span v-if="statusText" class="status-hint">{{ statusText }}</span>

      <template v-if="!isReadOnly">
        <span class="separator" aria-hidden="true" />
        <div class="toolbar-group" role="toolbar" aria-label="Anmerkungswerkzeuge">
          <button
            type="button"
            class="tb-btn"
            :class="{toggled: editorMode === modes.NONE}"
            title="Auswahlwerkzeug"
            aria-label="Auswahlwerkzeug"
            :disabled="!pdfLoaded"
            @click="setMode(modes.NONE)"
          >
            <span class="tb-icon icon-select" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="tb-btn"
            :class="{toggled: editorMode === modes.HIGHLIGHT}"
            title="Text markieren"
            aria-label="Text markieren"
            :disabled="!pdfLoaded"
            @click="setMode(modes.HIGHLIGHT)"
          >
            <span class="tb-icon icon-highlight" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="tb-btn"
            :class="{toggled: editorMode === modes.FREETEXT}"
            title="Textnotiz einfügen"
            aria-label="Textnotiz einfügen"
            :disabled="!pdfLoaded"
            @click="setMode(modes.FREETEXT)"
          >
            <span class="tb-icon icon-freetext" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="tb-btn"
            :class="{toggled: editorMode === modes.INK}"
            title="Freihand zeichnen"
            aria-label="Freihand zeichnen"
            :disabled="!pdfLoaded"
            @click="setMode(modes.INK)"
          >
            <span class="tb-icon icon-ink" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="tb-btn"
            :class="{toggled: editorMode === modes.STAMP}"
            title="Bild einfügen"
            aria-label="Bild einfügen"
            :disabled="!pdfLoaded"
            @click="setMode(modes.STAMP)"
          >
            <span class="tb-icon icon-stamp" aria-hidden="true" />
          </button>
        </div>
      </template>
      <template v-else>
        <span class="separator" aria-hidden="true" />
        <span class="status-hint">Schreibgeschützt</span>
      </template>

      <span class="separator" aria-hidden="true" />
      <button
        type="button"
        class="tb-btn"
        :class="{toggled: sidebarOpen}"
        title="Kommentare"
        aria-label="Kommentare"
        :disabled="!pdfLoaded"
        @click="toggleSidebar"
      >
        <span class="tb-icon icon-comments" aria-hidden="true" />
      </button>
      <button
        v-if="!isReadOnly"
        type="button"
        class="tb-btn"
        title="In OpenCloud speichern"
        aria-label="In OpenCloud speichern"
        :disabled="!pdfLoaded || saving"
        @click="saveToOpenCloud"
      >
        <span class="tb-icon icon-save" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="tb-btn"
        :class="{toggled: menuOpen}"
        title="Werkzeuge"
        aria-label="Werkzeuge"
        @click="menuOpen = !menuOpen"
      >
        <span class="tb-icon icon-menu" aria-hidden="true" />
      </button>
    </header>

    <main
      ref="regionElement"
      class="viewer-region"
      :class="{'with-sidebar': sidebarOpen, 'with-outline': outlineOpen}"
    >
      <div
        ref="containerElement"
        class="viewer-scroll"
        :class="{'hand-tool': handTool}"
      >
        <div ref="viewerElement" class="pdfViewer" />
      </div>
      <div v-if="findOpen" class="pdfa-findbar">
        <input
          ref="findInputElement"
          v-model="findQuery"
          class="pdfa-find-input"
          type="text"
          placeholder="Im Dokument suchen …"
          aria-label="Suchen"
          @input="onFindInput"
          @keydown.enter="findAgain($event.shiftKey)"
        />
        <button
          type="button"
          class="tb-btn"
          title="Vorheriger Treffer"
          aria-label="Vorheriger Treffer"
          @click="findAgain(true)"
        >
          <span class="tb-icon icon-find-prev" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="tb-btn"
          title="Nächster Treffer"
          aria-label="Nächster Treffer"
          @click="findAgain(false)"
        >
          <span class="tb-icon icon-find-next" aria-hidden="true" />
        </button>
        <span v-if="findMatches && findQuery" class="pdfa-find-count">
          {{ findMatches.total ? `${findMatches.current} von ${findMatches.total}` : 'Keine Treffer' }}
        </span>
      </div>
      <aside v-if="outlineOpen" class="pdfa-outline" aria-label="Dokumentstruktur">
        <div class="pdfa-comments-header">Dokumentstruktur</div>
        <p v-if="!outlineItems.length" class="pdfa-comments-empty">
          Keine Dokumentstruktur vorhanden.
        </p>
        <ul v-else class="pdfa-outline-list">
          <li v-for="(item, index) in outlineItems" :key="index">
            <button
              type="button"
              class="pdfa-outline-entry"
              :style="{paddingInlineStart: `${12 + item.depth * 14}px`}"
              @click="goToOutlineItem(item.dest)"
            >
              {{ item.title }}
            </button>
          </li>
        </ul>
      </aside>
      <div v-if="menuOpen" class="pdfa-menu-backdrop" @pointerdown.self="closeMenu" />
      <div v-if="menuOpen" class="pdfa-menu" role="menu">
        <button type="button" role="menuitem" :disabled="currentPage <= 1" @click="goFirstPage">
          <span class="pdfa-menu-icon mi-first-page" aria-hidden="true" />Erste Seite anzeigen
        </button>
        <button
          type="button"
          role="menuitem"
          :disabled="currentPage >= pageCount"
          @click="goLastPage"
        >
          <span class="pdfa-menu-icon mi-last-page" aria-hidden="true" />Letzte Seite anzeigen
        </button>
        <div class="pdfa-menu-divider" />
        <button type="button" role="menuitem" @click="rotatePages(90)">
          <span class="pdfa-menu-icon mi-rotate-cw" aria-hidden="true" />Im Uhrzeigersinn drehen
        </button>
        <button type="button" role="menuitem" @click="rotatePages(-90)">
          <span class="pdfa-menu-icon mi-rotate-ccw" aria-hidden="true" />Gegen den Uhrzeigersinn
          drehen
        </button>
        <div class="pdfa-menu-divider" />
        <button
          type="button"
          role="menuitem"
          :class="{active: !handTool}"
          @click="setHandTool(false)"
        >
          <span class="pdfa-menu-icon mi-select-tool" aria-hidden="true" />Textauswahl-Werkzeug
        </button>
        <button type="button" role="menuitem" :class="{active: handTool}" @click="setHandTool(true)">
          <span class="pdfa-menu-icon mi-hand-tool" aria-hidden="true" />Hand-Werkzeug
        </button>
        <div class="pdfa-menu-divider" />
        <button
          type="button"
          role="menuitem"
          :class="{active: scrollModeState === ScrollMode.PAGE}"
          @click="setScrollMode(ScrollMode.PAGE)"
        >
          <span class="pdfa-menu-icon mi-scroll-page" aria-hidden="true" />Einzelseitenanordnung
        </button>
        <button
          type="button"
          role="menuitem"
          :class="{active: scrollModeState === ScrollMode.VERTICAL}"
          @click="setScrollMode(ScrollMode.VERTICAL)"
        >
          <span class="pdfa-menu-icon mi-scroll-vertical" aria-hidden="true" />Vertikale
          Seitenanordnung
        </button>
        <button
          type="button"
          role="menuitem"
          :class="{active: scrollModeState === ScrollMode.HORIZONTAL}"
          @click="setScrollMode(ScrollMode.HORIZONTAL)"
        >
          <span class="pdfa-menu-icon mi-scroll-horizontal" aria-hidden="true" />Horizontale
          Seitenanordnung
        </button>
        <button
          type="button"
          role="menuitem"
          :class="{active: scrollModeState === ScrollMode.WRAPPED}"
          @click="setScrollMode(ScrollMode.WRAPPED)"
        >
          <span class="pdfa-menu-icon mi-scroll-wrapped" aria-hidden="true" />Kombinierte
          Seitenanordnung
        </button>
        <div class="pdfa-menu-divider" />
        <button
          type="button"
          role="menuitem"
          :class="{active: spreadModeState === SpreadMode.NONE}"
          @click="setSpreadMode(SpreadMode.NONE)"
        >
          <span class="pdfa-menu-icon mi-spread-none" aria-hidden="true" />Einzelne Seiten
        </button>
        <button
          type="button"
          role="menuitem"
          :class="{active: spreadModeState === SpreadMode.ODD}"
          @click="setSpreadMode(SpreadMode.ODD)"
        >
          <span class="pdfa-menu-icon mi-spread-odd" aria-hidden="true" />Ungerade + gerade Seite
        </button>
        <button
          type="button"
          role="menuitem"
          :class="{active: spreadModeState === SpreadMode.EVEN}"
          @click="setSpreadMode(SpreadMode.EVEN)"
        >
          <span class="pdfa-menu-icon mi-spread-even" aria-hidden="true" />Gerade + ungerade Seite
        </button>
        <div class="pdfa-menu-divider" />
        <button type="button" role="menuitem" @click="openDocProps">
          <span class="pdfa-menu-icon mi-doc-props" aria-hidden="true" />Dokumenteigenschaften…
        </button>
        <button type="button" role="menuitem" @click="((aboutOpen = true), closeMenu())">
          <span class="pdfa-menu-icon mi-about" aria-hidden="true" />Über PDF Annotator
        </button>
      </div>
      <div
        v-if="docPropsOpen"
        class="pdfa-about-backdrop"
        @pointerdown.self="docPropsOpen = false"
      >
        <div class="pdfa-about-dialog" role="dialog" aria-label="Dokumenteigenschaften">
          <h2 class="pdfa-about-title">Dokumenteigenschaften</h2>
          <dl class="pdfa-about-rows">
            <template v-for="row in docProps" :key="row.label">
              <dt>{{ row.label }}</dt>
              <dd>{{ row.value }}</dd>
            </template>
          </dl>
          <div class="pdfa-about-actions">
            <span class="pdfa-comment-spacer" />
            <button type="button" class="pdfa-about-close" @click="docPropsOpen = false">
              Schließen
            </button>
          </div>
        </div>
      </div>
      <aside v-if="sidebarOpen" class="pdfa-comments-sidebar" aria-label="Kommentare">
        <div class="pdfa-comments-header">Kommentare ({{ sidebarComments.length }})</div>
        <p v-if="!sidebarComments.length" class="pdfa-comments-empty">
          Keine Kommentare im Dokument.
        </p>
        <ul v-else class="pdfa-comments-list">
          <li v-for="entry in sidebarComments" :key="entry.key">
            <button type="button" class="pdfa-comment-entry" @click="goToComment(entry)">
              <span class="pdfa-comment-meta">
                <strong>{{ entry.author || 'Unbekannt' }}</strong>
                <span>Seite {{ entry.page }}</span>
              </span>
              <span v-if="entry.dateLabel" class="pdfa-comment-date">{{ entry.dateLabel }}</span>
              <span class="pdfa-comment-body">{{ entry.text }}</span>
            </button>
          </li>
        </ul>
      </aside>
      <div v-if="error" class="error-banner">{{ error }}</div>
      <div v-if="aboutOpen" class="pdfa-about-backdrop" @pointerdown.self="closeAbout">
        <div class="pdfa-about-dialog" role="dialog" aria-label="Über PDF Annotator">
          <h2 class="pdfa-about-title">PDF Annotator</h2>
          <dl class="pdfa-about-rows">
            <dt>Version</dt>
            <dd>{{ aboutInfo.version }}</dd>
            <dt>Git-Commit</dt>
            <dd class="pdfa-about-mono">{{ aboutInfo.commit }}</dd>
            <dt>Build</dt>
            <dd>{{ aboutInfo.buildTime }}</dd>
            <dt>pdf.js</dt>
            <dd>{{ aboutInfo.pdfjsVersion }}</dd>
          </dl>
          <textarea
            v-if="diagnostics"
            class="pdfa-about-diagnostics"
            readonly
            rows="8"
            :value="diagnostics"
            @focus="($event.target as HTMLTextAreaElement).select()"
          />
          <div class="pdfa-about-actions">
            <button type="button" class="pdfa-about-diag" @click="runDiagnostics">
              Diagnose
            </button>
            <span class="pdfa-comment-spacer" />
            <button type="button" class="pdfa-about-close" @click="closeAbout">
              Schließen
            </button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import {
  AnnotationEditorType,
  getDocument,
  GlobalWorkerOptions,
  PDFDateString,
  version as pdfjsVersion,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  EventBus,
  GenericL10n,
  PDFFindController,
  PDFLinkService,
  PDFViewer,
  ScrollMode,
  SpreadMode,
} from 'pdfjs-dist/legacy/web/pdf_viewer.mjs';
import PdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?worker&inline';
import 'pdfjs-dist/legacy/web/pdf_viewer.css';
import type {Resource} from '@opencloud-eu/web-client';
import {computed, onBeforeUnmount, onMounted, ref, shallowRef, watch} from 'vue';
import {PdfCommentManager} from './commentManager';
import {userContext} from './userContext';
import iconCommentEdit from 'pdfjs-dist/legacy/web/images/comment-editButton.svg?url';
import iconEditorDelete from 'pdfjs-dist/legacy/web/images/editor-toolbar-delete.svg?url';
import iconSelect from 'pdfjs-dist/legacy/web/images/secondaryToolbarButton-selectTool.svg?url';
import iconFreeText from 'pdfjs-dist/legacy/web/images/toolbarButton-editorFreeText.svg?url';
import iconHighlight from 'pdfjs-dist/legacy/web/images/toolbarButton-editorHighlight.svg?url';
import iconInk from 'pdfjs-dist/legacy/web/images/toolbarButton-editorInk.svg?url';
import iconStamp from 'pdfjs-dist/legacy/web/images/toolbarButton-editorStamp.svg?url';
import iconPageDown from 'pdfjs-dist/legacy/web/images/toolbarButton-pageDown.svg?url';
import iconPageUp from 'pdfjs-dist/legacy/web/images/toolbarButton-pageUp.svg?url';
import iconZoomIn from 'pdfjs-dist/legacy/web/images/toolbarButton-zoomIn.svg?url';
import iconZoomOut from 'pdfjs-dist/legacy/web/images/toolbarButton-zoomOut.svg?url';
import iconSave from 'pdfjs-dist/legacy/web/images/toolbarButton-download.svg?url';
import iconSearch from 'pdfjs-dist/legacy/web/images/toolbarButton-search.svg?url';
import iconMenuToggle from 'pdfjs-dist/legacy/web/images/toolbarButton-secondaryToolbarToggle.svg?url';
import iconOutline from 'pdfjs-dist/legacy/web/images/toolbarButton-viewOutline.svg?url';
import iconFindNext from 'pdfjs-dist/legacy/web/images/findbarButton-next.svg?url';
import iconFindPrev from 'pdfjs-dist/legacy/web/images/findbarButton-previous.svg?url';
import iconFirstPage from 'pdfjs-dist/legacy/web/images/secondaryToolbarButton-firstPage.svg?url';
import iconLastPage from 'pdfjs-dist/legacy/web/images/secondaryToolbarButton-lastPage.svg?url';
import iconRotateCw from 'pdfjs-dist/legacy/web/images/secondaryToolbarButton-rotateCw.svg?url';
import iconRotateCcw from 'pdfjs-dist/legacy/web/images/secondaryToolbarButton-rotateCcw.svg?url';
import iconHandTool from 'pdfjs-dist/legacy/web/images/secondaryToolbarButton-handTool.svg?url';
import iconScrollPage from 'pdfjs-dist/legacy/web/images/secondaryToolbarButton-scrollPage.svg?url';
import iconScrollVertical from 'pdfjs-dist/legacy/web/images/secondaryToolbarButton-scrollVertical.svg?url';
import iconScrollHorizontal from 'pdfjs-dist/legacy/web/images/secondaryToolbarButton-scrollHorizontal.svg?url';
import iconScrollWrapped from 'pdfjs-dist/legacy/web/images/secondaryToolbarButton-scrollWrapped.svg?url';
import iconSpreadNone from 'pdfjs-dist/legacy/web/images/secondaryToolbarButton-spreadNone.svg?url';
import iconSpreadOdd from 'pdfjs-dist/legacy/web/images/secondaryToolbarButton-spreadOdd.svg?url';
import iconSpreadEven from 'pdfjs-dist/legacy/web/images/secondaryToolbarButton-spreadEven.svg?url';
import iconDocProps from 'pdfjs-dist/legacy/web/images/secondaryToolbarButton-documentProperties.svg?url';

// The original pdf.js icon set ships with pdfjs-dist; the files are small
// enough for Vite to inline them as data URIs (Module-Federation-safe).
// `--comment-edit-button-icon` is referenced by the components stylesheet
// for the annotation comment buttons but never defined there.
const aboutIconSvg =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'>" +
  "<path d='M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1zm0 1.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM8 3.9a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2zM7.1 7h1.8v5.2H7.1z'/>" +
  '</svg>';

// Firefox paints mask-image icons on annotation-UI ::before elements at a
// displaced position (DOM geometry correct, icons visibly astray), so icons
// are pre-tinted SVGs drawn as background-image on the BUTTON itself — never
// via mask/::before. pdf.js sources use fill='black' / fill="black".
function tintIcon(dataUri: string, color: string): string {
  return dataUri
    .replaceAll("fill='black'", `fill='${color}'`)
    .replaceAll('fill="black"', `fill="${color}"`)
    .replaceAll("fill='%23000'", `fill='${color}'`)
    .replaceAll('fill="%23000"', `fill="${color}"`);
}

const ICON_GRAY = '%235B5B66';
const ICON_LIGHT = '%23FBFBFE';

const iconVars = {
  '--tbi-select': `url("${iconSelect}")`,
  '--tbi-about': `url("data:image/svg+xml,${encodeURIComponent(aboutIconSvg)}")`,
  '--tbi-comments': `url("${iconCommentEdit}")`,
  '--mi-about': `url("data:image/svg+xml,${encodeURIComponent(aboutIconSvg)}")`,
  '--tbi-save': `url("${iconSave}")`,
  '--tbi-search': `url("${iconSearch}")`,
  '--tbi-menu': `url("${iconMenuToggle}")`,
  '--tbi-outline': `url("${iconOutline}")`,
  '--tbi-find-next': `url("${iconFindNext}")`,
  '--tbi-find-prev': `url("${iconFindPrev}")`,
  '--mi-first-page': `url("${iconFirstPage}")`,
  '--mi-last-page': `url("${iconLastPage}")`,
  '--mi-rotate-cw': `url("${iconRotateCw}")`,
  '--mi-rotate-ccw': `url("${iconRotateCcw}")`,
  '--mi-select-tool': `url("${iconSelect}")`,
  '--mi-hand-tool': `url("${iconHandTool}")`,
  '--mi-scroll-page': `url("${iconScrollPage}")`,
  '--mi-scroll-vertical': `url("${iconScrollVertical}")`,
  '--mi-scroll-horizontal': `url("${iconScrollHorizontal}")`,
  '--mi-scroll-wrapped': `url("${iconScrollWrapped}")`,
  '--mi-spread-none': `url("${iconSpreadNone}")`,
  '--mi-spread-odd': `url("${iconSpreadOdd}")`,
  '--mi-spread-even': `url("${iconSpreadEven}")`,
  '--mi-doc-props': `url("${iconDocProps}")`,
  '--tbi-freetext': `url("${iconFreeText}")`,
  '--tbi-highlight': `url("${iconHighlight}")`,
  '--tbi-ink': `url("${iconInk}")`,
  '--tbi-stamp': `url("${iconStamp}")`,
  '--tbi-page-up': `url("${iconPageUp}")`,
  '--tbi-page-down': `url("${iconPageDown}")`,
  '--tbi-zoom-in': `url("${iconZoomIn}")`,
  '--tbi-zoom-out': `url("${iconZoomOut}")`,
  '--comment-edit-button-icon': `url("${iconCommentEdit}")`,
  // Pre-tinted icons for the mask-free background-image rendering of the
  // annotation UI buttons (see the hardening styles below).
  '--pdfa-icon-comment': `url("${tintIcon(iconCommentEdit, ICON_GRAY)}")`,
  '--pdfa-icon-comment-invert': `url("${tintIcon(iconCommentEdit, ICON_LIGHT)}")`,
  '--pdfa-icon-delete': `url("${tintIcon(iconEditorDelete, ICON_GRAY)}")`,
  '--pdfa-icon-delete-invert': `url("${tintIcon(iconEditorDelete, ICON_LIGHT)}")`,
  '--pdfa-icon-highlight': `url("${tintIcon(iconHighlight, ICON_GRAY)}")`,
  '--pdfa-icon-highlight-invert': `url("${tintIcon(iconHighlight, ICON_LIGHT)}")`,
  // pdf.js positions the edit toolbar and the standalone comment button via
  // inline `calc(...% + var(...))` styles whose variables live in a :root
  // rule of pdf_viewer.css - i.e. on the shared <html> of the whole
  // OpenCloud page, where any other extension (e.g. another pdf.js copy)
  // can clobber them. A missing variable turns the whole calc() invalid,
  // `top` collapses to auto and the element falls to the bottom of the
  // page while its inline-end offset keeps working - annotations icons
  // then render detached near the page bottom. Defining the variables
  // inline on the app root makes our subtree independent of :root.
  '--editor-toolbar-vert-offset': '6px',
  '--comment-button-dim': '24px',
  '--dir-factor': '1',
};

type ContentValue = ArrayBuffer | Uint8Array | string;

const props = withDefaults(
  defineProps<{
    currentContent: ContentValue;
    isReadOnly?: boolean;
    resource: Resource;
  }>(),
  {isReadOnly: false},
);

const emit = defineEmits<{
  (event: 'update:currentContent', value: ArrayBuffer): void;
  (event: 'save'): void;
}>();

const modes = {
  NONE: AnnotationEditorType.NONE,
  FREETEXT: AnnotationEditorType.FREETEXT,
  HIGHLIGHT: AnnotationEditorType.HIGHLIGHT,
  INK: AnnotationEditorType.INK,
  STAMP: AnnotationEditorType.STAMP,
} as const;

const zoomPresets = [
  {value: 'auto', label: 'Automatischer Zoom'},
  {value: 'page-actual', label: 'Originalgröße'},
  {value: 'page-fit', label: 'Seitengröße'},
  {value: 'page-width', label: 'Seitenbreite'},
  {value: '0.5', label: '50%'},
  {value: '0.75', label: '75%'},
  {value: '1', label: '100%'},
  {value: '1.25', label: '125%'},
  {value: '1.5', label: '150%'},
  {value: '2', label: '200%'},
  {value: '3', label: '300%'},
  {value: '4', label: '400%'},
];

const regionElement = ref<HTMLElement>();
const containerElement = ref<HTMLDivElement>();
const viewerElement = ref<HTMLDivElement>();
const editorMode = ref<number>(modes.NONE);
const currentPage = ref(1);
const pageInputValue = ref('1');
const pageCount = ref(0);
const scale = ref(1);
const zoomSelect = ref('auto');
const pdfLoaded = ref(false);
const aboutOpen = ref(false);
const sidebarOpen = ref(false);
const sidebarComments = ref<CommentEntry[]>([]);
const menuOpen = ref(false);
const findOpen = ref(false);
const findQuery = ref('');
const findMatches = ref<{current: number; total: number} | null>(null);
const findInputElement = ref<HTMLInputElement>();
const outlineOpen = ref(false);
const outlineItems = ref<Array<{title: string; dest: unknown; depth: number}>>([]);
const docPropsOpen = ref(false);
const docProps = ref<Array<{label: string; value: string}>>([]);
const handTool = ref(false);
const scrollModeState = ref<number>(ScrollMode.VERTICAL);
const spreadModeState = ref<number>(SpreadMode.NONE);
const saving = ref(false);
const pendingCommit = ref(false);
const error = ref('');

// pdf.js objects rely on identity checks internally; keep them out of Vue's
// deep reactivity (same class of bug as the Blockly workspace in
// blockberry-editor).
const viewer = shallowRef<PDFViewer>();
let eventBus: EventBus | undefined;
let linkService: PDFLinkService | undefined;
let loadingTask: PDFDocumentLoadingTask | undefined;
let pdfDocument: PDFDocumentProxy | undefined;
let resizeObserver: ResizeObserver | undefined;
let commentManager: PdfCommentManager | undefined;
let commitTimer = 0;
let commitInFlight = false;
let commitQueued = false;
let loadToken = 0;
let lastEmitted: ArrayBuffer | undefined;
let lastAppliedContent: ContentValue | undefined;

const aboutInfo = {
  version: __PDFA_VERSION__,
  commit: __PDFA_COMMIT__,
  buildTime: new Date(__PDFA_BUILD_TIME__).toLocaleString('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }),
  pdfjsVersion,
};

const diagnostics = ref('');

function closeAbout(): void {
  aboutOpen.value = false;
  diagnostics.value = '';
}

/**
 * Captures the live geometry and styling of the pdf.js annotation UI so a
 * misrendering in a production OpenCloud (host CSS we cannot reproduce
 * locally) can be debugged from a pasted report.
 */
function runDiagnostics(): void {
  const round = (value: number): number => Math.round(value);
  const elements: unknown[] = [];
  const pseudo = (el: Element, which: '::before' | '::after'): unknown => {
    const ps = getComputedStyle(el, which);
    const mask = ps.maskImage || '';
    const webkitMask = ps.webkitMaskImage || '';
    const bgImage = ps.backgroundImage || '';
    if (
      ps.content === 'none' &&
      (!mask || mask === 'none') &&
      (!webkitMask || webkitMask === 'none') &&
      (!bgImage || bgImage === 'none')
    ) {
      return undefined;
    }
    return {
      content: ps.content.slice(0, 20),
      display: ps.display,
      position: ps.position,
      top: ps.top,
      left: ps.left,
      width: ps.width,
      height: ps.height,
      margin: ps.margin,
      transform: ps.transform,
      mask: mask.slice(0, 40),
      webkitMask: webkitMask.slice(0, 40),
      bg: ps.backgroundColor,
      bgImage: bgImage.slice(0, 60),
    };
  };
  const record = (el: Element, kind: string): void => {
    if (elements.length >= 120) return;
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const parents: string[] = [];
    let ancestor = el.parentElement;
    for (let depth = 0; ancestor && depth < 3; depth++) {
      parents.push(`${ancestor.tagName.toLowerCase()}.${String(ancestor.className).slice(0, 40)}`);
      ancestor = ancestor.parentElement;
    }
    elements.push({
      kind,
      tag: el.tagName.toLowerCase(),
      id: el.id || undefined,
      cls: String(el.className).slice(0, 80),
      parents,
      rect: {x: round(rect.x), y: round(rect.y), w: round(rect.width), h: round(rect.height)},
      inline: (el as HTMLElement).style.cssText.slice(0, 200),
      pos: cs.position,
      top: cs.top,
      insetInlineEnd: cs.insetInlineEnd,
      display: cs.display,
      transform: cs.transform === 'none' ? undefined : cs.transform,
      vars: {
        vertOffset: cs.getPropertyValue('--editor-toolbar-vert-offset'),
        commentDim: cs.getPropertyValue('--comment-button-dim'),
        scaleFactor: cs.getPropertyValue('--scale-factor'),
      },
      before: pseudo(el, '::before'),
      after: pseudo(el, '::after'),
    });
  };
  const host = regionElement.value ?? document.body;
  const seen = new Set<Element>();
  const track = (el: Element, kind: string): void => {
    if (seen.has(el)) return;
    seen.add(el);
    record(el, kind);
  };
  host
    .querySelectorAll('.annotationEditorLayer, .textLayer, .annotationLayer')
    .forEach((el) => track(el, 'layer'));
  host
    .querySelectorAll(
      '.editToolbar, .editToolbar *, .annotationCommentButton, ' +
        '.freeTextEditor, .inkEditor, .stampEditor, .highlightEditor, .signatureEditor',
    )
    .forEach((el) => track(el, 'ui'));
  // Dragnet: any element in the viewer whose pseudo elements paint a mask
  // icon - catches pdf.js UI we did not anticipate, wherever it renders.
  host.querySelectorAll('*').forEach((el) => {
    if (seen.has(el)) return;
    const before = getComputedStyle(el, '::before');
    const after = getComputedStyle(el, '::after');
    const maskBefore = before.webkitMaskImage || before.maskImage;
    const maskAfter = after.webkitMaskImage || after.maskImage;
    if ((maskBefore && maskBefore !== 'none') || (maskAfter && maskAfter !== 'none')) {
      track(el, 'masked');
    }
  });
  const report = {
    commit: aboutInfo.commit,
    pdfjs: pdfjsVersion,
    userAgent: navigator.userAgent,
    viewport: {w: window.innerWidth, h: window.innerHeight},
    rootColorScheme: getComputedStyle(document.documentElement).colorScheme,
    rootVertOffset: getComputedStyle(document.documentElement).getPropertyValue(
      '--editor-toolbar-vert-offset',
    ),
    styleSheets: Array.from(document.styleSheets).map((sheet) => {
      let rules = -1;
      try {
        rules = sheet.cssRules.length;
      } catch {
        /* cross-origin */
      }
      return {href: sheet.href, rules};
    }),
    elements,
  };
  diagnostics.value = JSON.stringify(report);
  void navigator.clipboard?.writeText(diagnostics.value).catch(() => {});
}

const customZoomLabel = computed(() => `${Math.round(scale.value * 100)} %`);
const statusText = computed(() => {
  if (saving.value) return 'Anmerkungen werden übernommen …';
  if (pendingCommit.value) return 'Anmerkung ausstehend';
  return '';
});

watch(currentPage, (page) => {
  pageInputValue.value = String(page);
});

function toBytes(value: ContentValue | undefined): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (typeof value === 'string') {
    const bytes = new Uint8Array(value.length);
    for (let index = 0; index < value.length; index++) {
      bytes[index] = value.charCodeAt(index) & 0xff;
    }
    return bytes;
  }
  return new Uint8Array(0);
}

async function loadDocumentFrom(source: ContentValue): Promise<void> {
  const token = ++loadToken;
  error.value = '';
  const bytes = toBytes(source);
  if (!bytes.length) {
    pdfLoaded.value = false;
    error.value = 'Die Datei ist leer oder konnte nicht geladen werden.';
    return;
  }

  // getDocument transfers the buffer to the worker, so hand over a copy.
  const task = getDocument({data: bytes.slice()});
  try {
    const document = await task.promise;
    if (token !== loadToken) {
      void document.destroy();
      return;
    }
    if (loadingTask && loadingTask !== task) {
      void loadingTask.destroy();
    }
    loadingTask = task;
    pdfDocument = document;
    wireAnnotationAutosave(document);
    pageCount.value = document.numPages;
    currentPage.value = 1;
    viewer.value!.setDocument(document);
    linkService!.setDocument(document, null);
    lastAppliedContent = source;
    pendingCommit.value = false;
    pdfLoaded.value = true;
    void loadOutline();
    editorMode.value = modes.NONE;
  } catch (loadError) {
    if (token !== loadToken) return;
    pdfLoaded.value = false;
    error.value = `PDF konnte nicht geladen werden: ${
      loadError instanceof Error ? loadError.message : String(loadError)
    }`;
  }
}

function setMode(mode: number): void {
  if (!viewer.value || !pdfLoaded.value || props.isReadOnly) return;
  try {
    viewer.value.annotationEditorMode = {mode};
    editorMode.value = mode;
  } catch (modeError) {
    console.error(modeError);
  }
}


// --- Search (pdf.js find controller) ---------------------------------------

function dispatchFind(type: string, findPrevious = false): void {
  eventBus?.dispatch('find', {
    source: null,
    type,
    query: findQuery.value,
    caseSensitive: false,
    entireWord: false,
    highlightAll: true,
    findPrevious,
    matchDiacritics: false,
  });
}

function toggleFind(): void {
  findOpen.value = !findOpen.value;
  if (findOpen.value) {
    requestAnimationFrame(() => findInputElement.value?.select());
  } else {
    findMatches.value = null;
    eventBus?.dispatch('findbarclose', {source: null});
  }
}

function onFindInput(): void {
  dispatchFind('');
}

function findAgain(previous: boolean): void {
  dispatchFind('again', previous);
}

// --- Document outline (Dokumentstruktur) -----------------------------------

async function loadOutline(): Promise<void> {
  outlineItems.value = [];
  if (!pdfDocument) return;
  type RawOutlineNode = {title: string; dest: unknown; items?: RawOutlineNode[]};
  const outline = (await pdfDocument.getOutline().catch((): null => null)) as
    | RawOutlineNode[]
    | null;
  if (!outline) return;
  const flat: Array<{title: string; dest: unknown; depth: number}> = [];
  const walk = (nodes: RawOutlineNode[], depth: number): void => {
    for (const node of nodes) {
      flat.push({title: node.title, dest: node.dest, depth});
      if (node.items?.length && depth < 6) walk(node.items, depth + 1);
    }
  };
  walk(outline, 0);
  outlineItems.value = flat;
}

function goToOutlineItem(dest: unknown): void {
  if (!dest || !linkService) return;
  void linkService.goToDestination(dest as string);
}

// --- Secondary toolbar menu -------------------------------------------------

function closeMenu(): void {
  menuOpen.value = false;
}

function goFirstPage(): void {
  if (viewer.value) viewer.value.currentPageNumber = 1;
  closeMenu();
}

function goLastPage(): void {
  if (viewer.value) viewer.value.currentPageNumber = pageCount.value || 1;
  closeMenu();
}

function rotatePages(delta: number): void {
  if (viewer.value) {
    viewer.value.pagesRotation = (viewer.value.pagesRotation + delta + 360) % 360;
  }
  closeMenu();
}

function setHandTool(enabled: boolean): void {
  handTool.value = enabled;
  closeMenu();
}

function setScrollMode(mode: number): void {
  if (viewer.value) viewer.value.scrollMode = mode;
  scrollModeState.value = mode;
  closeMenu();
}

function setSpreadMode(mode: number): void {
  if (viewer.value) viewer.value.spreadMode = mode;
  spreadModeState.value = mode;
  closeMenu();
}

// --- Hand tool: drag to pan the scroll container ----------------------------

let panPointer: {id: number; x: number; y: number; left: number; top: number} | null = null;

function onPanPointerDown(event: PointerEvent): void {
  if (!handTool.value || event.button !== 0) return;
  const target = event.target as HTMLElement;
  if (target.closest('.editToolbar, .annotationCommentButton, .pdfa-comment-dialog')) return;
  const container = containerElement.value;
  if (!container) return;
  panPointer = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    left: container.scrollLeft,
    top: container.scrollTop,
  };
  container.setPointerCapture(event.pointerId);
  event.preventDefault();
}

function onPanPointerMove(event: PointerEvent): void {
  const container = containerElement.value;
  if (!panPointer || panPointer.id !== event.pointerId || !container) return;
  container.scrollLeft = panPointer.left - (event.clientX - panPointer.x);
  container.scrollTop = panPointer.top - (event.clientY - panPointer.y);
}

function onPanPointerUp(event: PointerEvent): void {
  if (panPointer?.id === event.pointerId) panPointer = null;
}

// --- Document properties -----------------------------------------------------

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB (${bytes.toLocaleString('de-DE')} Bytes)`;
  return `${(kb / 1024).toFixed(2)} MB (${bytes.toLocaleString('de-DE')} Bytes)`;
}

async function openDocProps(): Promise<void> {
  closeMenu();
  const rows: Array<{label: string; value: string}> = [];
  const push = (label: string, value: unknown): void => {
    const text = typeof value === 'string' ? value.trim() : '';
    if (text) rows.push({label, value: text});
  };
  push('Dateiname', props.resource?.name);
  push('Dateigröße', formatFileSize(Number(props.resource?.size ?? 0)));
  if (pdfDocument) {
    const {info} = (await pdfDocument.getMetadata().catch(() => ({info: {}}))) as {
      info: Record<string, unknown>;
    };
    push('Titel', info.Title);
    push('Verfasser', info.Author);
    push('Thema', info.Subject);
    push('Stichwörter', info.Keywords);
    push('Erstellt am', formatCommentDate(info.CreationDate));
    push('Bearbeitet am', formatCommentDate(info.ModDate));
    push('Anwendung', info.Creator);
    push('PDF-Ersteller', info.Producer);
    push('PDF-Version', info.PDFFormatVersion);
    push('Seitenanzahl', String(pdfDocument.numPages));
  }
  docProps.value = rows;
  docPropsOpen.value = true;
}

// --- Explicit save to OpenCloud ---------------------------------------------

async function saveToOpenCloud(): Promise<void> {
  if (props.isReadOnly || !pdfLoaded.value) return;
  window.clearTimeout(commitTimer);
  await commitAnnotations();
  emit('save');
}

type CommentEntry = {
  key: string;
  author: string;
  text: string;
  page: number;
  rect?: number[];
  dateLabel?: string;
};

function formatCommentDate(value: unknown): string {
  let date: Date | null = null;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'string') {
    date = (PDFDateString as {toDateObject: (v: unknown) => Date | null}).toDateObject(value);
  } else if (typeof value === 'number') {
    date = new Date(value);
  }
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('de-DE', {dateStyle: 'medium', timeStyle: 'short'});
}

/**
 * Collects a summary of every comment in the document: comments stored in
 * the PDF (author from the annotation's /T field) plus not-yet-saved
 * comment edits from this session, attributed to the signed-in OpenCloud
 * user. pdf.js does not persist an author for annotations it creates, so
 * entries saved by this app show up without an author after reopening.
 */
async function collectComments(): Promise<CommentEntry[]> {
  const doc = pdfDocument;
  if (!doc) return [];
  const entries: CommentEntry[] = [];

  type SavedComment = {
    id: string;
    author: string;
    text: string;
    page: number;
    rect?: number[];
    dateLabel: string;
  };
  const saved: SavedComment[] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const annotations = (await page.getAnnotations()) as Array<{
      id: string;
      subtype?: string;
      popupRef?: string | null;
      contentsObj?: {str?: string};
      titleObj?: {str?: string};
      modificationDate?: string | null;
      rect?: number[];
    }>;
    for (const annotation of annotations) {
      if (annotation.subtype === 'Popup') continue;
      const text = annotation.contentsObj?.str ?? '';
      if (!annotation.popupRef || !text) continue;
      saved.push({
        id: String(annotation.id),
        author: annotation.titleObj?.str ?? '',
        text,
        page: pageNumber,
        rect: Array.isArray(annotation.rect) ? annotation.rect : undefined,
        dateLabel: formatCommentDate(annotation.modificationDate),
      });
    }
  }

  // Unsaved changes: the annotation storage serializes edited comments as
  // popup entries; editors without an annotation id are new in this session.
  const removedIds = new Set<string>();
  const overriddenIds = new Set<string>();
  const {serializable} = doc.annotationStorage as unknown as {
    serializable: {map: Map<string, Record<string, unknown>> | null};
  };
  for (const [uid, value] of serializable.map ?? []) {
    if (!value) continue;
    const annotationId = typeof value.id === 'string' ? value.id : '';
    if (value.deleted) {
      if (annotationId) removedIds.add(annotationId);
      continue;
    }
    const popup = value.popup as {contents?: string; deleted?: boolean} | undefined;
    if (!popup) continue;
    if (annotationId) overriddenIds.add(annotationId);
    if (popup.deleted || !popup.contents) continue;
    const savedEntry = annotationId
      ? saved.find((entry) => entry.id === annotationId)
      : undefined;
    entries.push({
      key: uid,
      author: savedEntry?.author || userContext.displayName,
      text: popup.contents,
      page: (typeof value.pageIndex === 'number' ? value.pageIndex : 0) + 1,
      rect: Array.isArray(value.rect) ? (value.rect as number[]) : undefined,
    });
  }

  for (const entry of saved) {
    if (removedIds.has(entry.id) || overriddenIds.has(entry.id)) continue;
    entries.push({
      key: `saved-${entry.id}`,
      author: entry.author,
      text: entry.text,
      page: entry.page,
      rect: entry.rect,
      dateLabel: entry.dateLabel,
    });
  }

  entries.sort((a, b) => a.page - b.page || (b.rect?.[3] ?? 0) - (a.rect?.[3] ?? 0));
  return entries;
}

async function refreshSidebar(): Promise<void> {
  try {
    sidebarComments.value = await collectComments();
  } catch (collectError) {
    console.error(collectError);
  }
}

function toggleSidebar(): void {
  sidebarOpen.value = !sidebarOpen.value;
  if (sidebarOpen.value) void refreshSidebar();
}

function goToComment(entry: CommentEntry): void {
  const pdfViewer = viewer.value;
  if (!pdfViewer || !pdfLoaded.value) return;
  if (entry.rect && entry.rect.length === 4) {
    pdfViewer.scrollPageIntoView({
      pageNumber: entry.page,
      destArray: [null, {name: 'XYZ'}, entry.rect[0] - 24, entry.rect[3] + 24, null],
    });
  } else {
    pdfViewer.currentPageNumber = entry.page;
  }
}

function scheduleCommit(): void {
  if (sidebarOpen.value) void refreshSidebar();
  if (props.isReadOnly) return;
  pendingCommit.value = true;
  window.clearTimeout(commitTimer);
  commitTimer = window.setTimeout(() => {
    void commitAnnotations();
  }, 1200);
}

/**
 * pdf.js only flips `onSetModified` from `AnnotationStorage.setValue`.
 * `remove()` never does — and when the last editor is removed it even calls
 * `resetModified()`. Delete-only edits (annotation trash, or deleting the
 * last new annotation after a prior save) therefore never autosaved.
 * Comment deletes that go through `UIManager.deleteComment` also skip our
 * commentManager `onChanged` hook. Patch both paths.
 */
function wireAnnotationAutosave(document: PDFDocumentProxy): void {
  const storage = document.annotationStorage as {
    onSetModified: (() => void) | null;
    remove: (key: string) => void;
  };
  storage.onSetModified = () => scheduleCommit();

  const originalRemove = storage.remove.bind(storage);
  storage.remove = (key: string) => {
    originalRemove(key);
    scheduleCommit();
  };
}

function wireUiManagerAutosave(uiManager: {
  delete: () => void;
  deleteComment: (editor: unknown, savedData: unknown) => void;
}): void {
  const originalDelete = uiManager.delete.bind(uiManager);
  uiManager.delete = () => {
    originalDelete();
    scheduleCommit();
  };
  const originalDeleteComment = uiManager.deleteComment.bind(uiManager);
  uiManager.deleteComment = (editor: unknown, savedData: unknown) => {
    originalDeleteComment(editor, savedData);
    scheduleCommit();
  };
}

async function commitAnnotations(): Promise<void> {
  if (!pdfDocument || props.isReadOnly || !pdfLoaded.value) return;
  if (commitInFlight) {
    commitQueued = true;
    return;
  }
  commitInFlight = true;
  saving.value = true;
  try {
    // Empty storage means "no pending editor changes" relative to the loaded
    // document. pdf.js warns that saveDocument is the wrong API then and that
    // getData should be used — which returns the base PDF (without any
    // session-only annotations that were just deleted from storage).
    const bytes =
      pdfDocument.annotationStorage.size > 0
        ? await pdfDocument.saveDocument()
        : await pdfDocument.getData();
    pdfDocument.annotationStorage.resetModified();
    // Emit an exact-size ArrayBuffer, never a Uint8Array view: axios sends
    // `view.buffer` for typed-array bodies, so a view over a larger buffer
    // would upload surrounding garbage bytes and corrupt the stored PDF.
    const payload =
      bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
        ? (bytes.buffer as ArrayBuffer)
        : (bytes.slice().buffer as ArrayBuffer);
    lastEmitted = payload;
    lastAppliedContent = payload;
    pendingCommit.value = false;
    emit('update:currentContent', payload);
  } catch (saveError) {
    error.value = `Anmerkungen konnten nicht übernommen werden: ${
      saveError instanceof Error ? saveError.message : String(saveError)
    }`;
  } finally {
    commitInFlight = false;
    saving.value = false;
    if (commitQueued) {
      commitQueued = false;
      void commitAnnotations();
    }
  }
}

function goPage(delta: number): void {
  if (!viewer.value || !pdfLoaded.value) return;
  const target = Math.min(Math.max(currentPage.value + delta, 1), pageCount.value || 1);
  viewer.value.currentPageNumber = target;
}

function onPageSubmit(): void {
  if (!viewer.value || !pdfLoaded.value) return;
  const parsed = Number.parseInt(pageInputValue.value, 10);
  const target = Number.isFinite(parsed)
    ? Math.min(Math.max(parsed, 1), pageCount.value || 1)
    : currentPage.value;
  pageInputValue.value = String(target);
  viewer.value.currentPageNumber = target;
}

function zoomIn(): void {
  if (!viewer.value || !pdfLoaded.value) return;
  viewer.value.currentScale = Math.min(4, viewer.value.currentScale * 1.1);
}

function zoomOut(): void {
  if (!viewer.value || !pdfLoaded.value) return;
  viewer.value.currentScale = Math.max(0.25, viewer.value.currentScale / 1.1);
}

function onZoomSelect(): void {
  if (!viewer.value || !pdfLoaded.value || zoomSelect.value === 'custom') return;
  const value = zoomSelect.value;
  if (value === 'auto' || value === 'page-actual' || value === 'page-fit' || value === 'page-width') {
    viewer.value.currentScaleValue = value;
  } else {
    viewer.value.currentScale = Number.parseFloat(value);
  }
}

watch(
  () => props.currentContent,
  (value) => {
    if (!viewer.value || value === undefined || value === null) return;
    // Ignore the echo of our own update:currentContent emissions.
    if (value === lastEmitted || value === lastAppliedContent) return;
    void loadDocumentFrom(value);
  },
);

function onWindowKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return;
  if (menuOpen.value) {
    event.stopPropagation();
    menuOpen.value = false;
  } else if (docPropsOpen.value) {
    event.stopPropagation();
    docPropsOpen.value = false;
  } else if (findOpen.value) {
    event.stopPropagation();
    toggleFind();
  } else if (aboutOpen.value) {
    event.stopPropagation();
    closeAbout();
  }
}

/**
 * Ctrl/Cmd + wheel (and trackpad pinch, which browsers deliver as a
 * ctrl-modified wheel) zooms the document towards the cursor instead of
 * letting the browser zoom the whole OpenCloud page.
 */
function onViewerWheel(event: WheelEvent): void {
  if (!event.ctrlKey && !event.metaKey) return;
  event.preventDefault();
  const container = containerElement.value;
  const pdfViewer = viewer.value;
  if (!container || !pdfViewer || !pdfLoaded.value) return;

  // Normalize the delta to pixels; classic wheels report lines (Firefox)
  // or a ±100px tick (Chromium), pinch gestures small pixel deltas.
  const deltaPixels =
    event.deltaMode === WheelEvent.DOM_DELTA_LINE
      ? event.deltaY * 40
      : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
        ? event.deltaY * 400
        : event.deltaY;
  const oldScale = pdfViewer.currentScale;
  const newScale = Math.min(4, Math.max(0.25, oldScale * 1.1 ** (-deltaPixels / 100)));
  if (newScale === oldScale) return;

  // Keep the document point under the cursor stationary: PDFViewer applies
  // the new layout sizes synchronously, so the scroll offsets can be
  // corrected right after setting the scale.
  const rect = container.getBoundingClientRect();
  const pointX = event.clientX - rect.left;
  const pointY = event.clientY - rect.top;
  pdfViewer.currentScale = newScale;
  const ratio = pdfViewer.currentScale / oldScale;
  container.scrollLeft = (container.scrollLeft + pointX) * ratio - pointX;
  container.scrollTop = (container.scrollTop + pointY) * ratio - pointY;
}

/**
 * Vite/lightningcss drops `-webkit-mask-image: none` from the bundled CSS
 * (only the `mask` shorthand survives). Firefox 153 still honors the
 * pdf.js `-webkit-mask-image` longhand on ::before, which is exactly what
 * paints the displaced ghost icons. Injecting the longhands at runtime
 * bypasses the minifier.
 */
let maskKillStyle: HTMLStyleElement | undefined;

function installMaskKillStyles(): void {
  if (maskKillStyle || typeof document === 'undefined') return;
  maskKillStyle = document.createElement('style');
  maskKillStyle.setAttribute('data-pdfa-mask-kill', '1');
  maskKillStyle.textContent = `
.pdf-annotator .editToolbar .buttons > :is(.basic, .comment, .commentButton, .deleteButton, .highlightButton)::before,
.pdf-annotator .editToolbar .buttons > :is(.basic, .comment, .commentButton, .deleteButton, .highlightButton)::after,
.pdf-annotator :is(.annotationLayer, .annotationEditorLayer) .annotationCommentButton::before,
.pdf-annotator :is(.annotationLayer, .annotationEditorLayer) .annotationCommentButton::after {
  content: none !important;
  display: none !important;
  width: 0 !important;
  height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  background: none !important;
  background-image: none !important;
  -webkit-mask-image: none !important;
  mask-image: none !important;
  -webkit-mask: none !important;
  mask: none !important;
}
`;
  document.head.appendChild(maskKillStyle);
}

function removeMaskKillStyles(): void {
  maskKillStyle?.remove();
  maskKillStyle = undefined;
}

onMounted(() => {
  installMaskKillStyles();
  window.addEventListener('keydown', onWindowKeydown, true);
  // passive:false so preventDefault can suppress the browser page zoom.
  containerElement.value!.addEventListener('wheel', onViewerWheel, {passive: false});
  GlobalWorkerOptions.workerPort ??= new PdfWorker();

  eventBus = new EventBus();
  linkService = new PDFLinkService({eventBus});
  const findController = new PDFFindController({
    eventBus,
    linkService,
    updateMatchesCountOnProgress: true,
  });
  commentManager = new PdfCommentManager({
    container: regionElement.value!,
    // Comment edits do not touch the annotation storage's modified flag,
    // so schedule the OpenCloud commit explicitly.
    onChanged: () => scheduleCommit(),
  });
  viewer.value = new PDFViewer({
    container: containerElement.value!,
    viewer: viewerElement.value!,
    eventBus,
    linkService,
    findController,
    // Supported by the runtime (threaded through to the annotation editors
    // and layers); the shipped PDFViewerOptions typings lag behind.
    ...({commentManager} as object),
    // Without a language GenericL10n uses its baked-in fallback bundle and
    // performs no locale fetches.
    l10n: new (GenericL10n as unknown as new (lang?: string) => InstanceType<typeof GenericL10n>)(),
    annotationEditorMode: props.isReadOnly
      ? AnnotationEditorType.DISABLE
      : AnnotationEditorType.NONE,
    annotationEditorHighlightColors:
      'yellow=#FFFF98,green=#53FFBC,blue=#80EBFF,pink=#FFCBE6,red=#FF4F5F',
  });
  linkService.setViewer(viewer.value);

  eventBus.on('annotationeditoruimanager', ({uiManager}: {uiManager: {
    delete: () => void;
    deleteComment: (editor: unknown, savedData: unknown) => void;
  }}) => {
    wireUiManagerAutosave(uiManager);
  });
  eventBus.on('pagesinit', () => {
    if (!viewer.value) return;
    viewer.value.currentScaleValue = 'auto';
    zoomSelect.value = 'auto';
  });
  eventBus.on('pagechanging', ({pageNumber}: {pageNumber: number}) => {
    currentPage.value = pageNumber;
  });
  eventBus.on(
    'updatefindmatchescount',
    ({matchesCount}: {matchesCount: {current: number; total: number}}) => {
      findMatches.value = matchesCount;
    },
  );
  eventBus.on(
    'updatefindcontrolstate',
    ({matchesCount}: {matchesCount: {current: number; total: number}}) => {
      findMatches.value = matchesCount;
    },
  );
  const scrollContainer = containerElement.value!;
  scrollContainer.addEventListener('pointerdown', onPanPointerDown);
  scrollContainer.addEventListener('pointermove', onPanPointerMove);
  scrollContainer.addEventListener('pointerup', onPanPointerUp);
  scrollContainer.addEventListener('pointercancel', onPanPointerUp);
  eventBus.on(
    'scalechanging',
    ({scale: newScale, presetValue}: {scale: number; presetValue?: string}) => {
      scale.value = newScale;
      if (presetValue) {
        zoomSelect.value = String(presetValue);
        return;
      }
      const preset = zoomPresets.find(
        (entry) => Math.abs(Number.parseFloat(entry.value) - newScale) < 0.001,
      );
      zoomSelect.value = preset ? preset.value : 'custom';
    },
  );
  resizeObserver = new ResizeObserver(() => {
    if (!viewer.value || !pdfLoaded.value) return;
    const scaleValue = viewer.value.currentScaleValue;
    if (scaleValue === 'page-width' || scaleValue === 'page-fit' || scaleValue === 'auto') {
      viewer.value.currentScaleValue = scaleValue;
    }
    viewer.value.update();
  });
  resizeObserver.observe(containerElement.value!);

  void loadDocumentFrom(props.currentContent);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onWindowKeydown, true);
  containerElement.value?.removeEventListener('wheel', onViewerWheel);
  window.clearTimeout(commitTimer);
  loadToken++;
  resizeObserver?.disconnect();
  commentManager?.destroy();
  commentManager = undefined;
  if (loadingTask) {
    void loadingTask.destroy();
  }
  loadingTask = undefined;
  pdfDocument = undefined;
  removeMaskKillStyles();
});
</script>

<style scoped>
.pdf-annotator {
  --toolbar-bg: #f9f9fa;
  --toolbar-border: #b6b6b8;
  --toolbar-text: #2a2a2e;
  --toolbar-icon: #5b5b66;
  --toolbar-muted: #6f6f77;
  --button-hover: #dddedf;
  --toggled-bg: #cfcfd4;
  --toggled-hover: #c2c2c9;
  --separator: #b6b6b8;
  --field-bg: #ffffff;
  --field-border: #8f8f9d;
  --accent: #0060df;
  --body-bg: #d4d4d7;

  color-scheme: light;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  background: var(--body-bg);
  font-family: system-ui, sans-serif;
}

@media (prefers-color-scheme: dark) {
  .pdf-annotator {
    --toolbar-bg: #38383d;
    --toolbar-border: #0c0c0d;
    --toolbar-text: #f9f9fa;
    --toolbar-icon: #fbfbfe;
    --toolbar-muted: #b1b1b9;
    --button-hover: #4a4a4f;
    --toggled-bg: #5b5b66;
    --toggled-hover: #67676f;
    --separator: #5b5b66;
    --field-bg: #2a2a2e;
    --field-border: #8f8f9d;
    --accent: #4db2ff;
    --body-bg: #2a2a2e;
    color-scheme: dark;
  }
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-wrap: wrap;
  min-height: 40px;
  padding: 4px 8px;
  background: var(--toolbar-bg);
  border-bottom: 1px solid var(--toolbar-border);
  color: var(--toolbar-text);
  font-size: 13px;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 2px;
}

.tb-btn {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--toolbar-icon);
  cursor: pointer;
}

.tb-icon {
  display: block;
  width: 16px;
  height: 16px;
  background-color: currentColor;
  -webkit-mask: var(--tb-icon) center / contain no-repeat;
  mask: var(--tb-icon) center / contain no-repeat;
}

.icon-select {
  --tb-icon: var(--tbi-select);
}
.icon-freetext {
  --tb-icon: var(--tbi-freetext);
}
.icon-highlight {
  --tb-icon: var(--tbi-highlight);
}
.icon-ink {
  --tb-icon: var(--tbi-ink);
}
.icon-stamp {
  --tb-icon: var(--tbi-stamp);
}
.icon-page-up {
  --tb-icon: var(--tbi-page-up);
}
.icon-page-down {
  --tb-icon: var(--tbi-page-down);
}
.icon-zoom-in {
  --tb-icon: var(--tbi-zoom-in);
}
.icon-zoom-out {
  --tb-icon: var(--tbi-zoom-out);
}
.icon-about {
  --tb-icon: var(--tbi-about);
}
.icon-comments {
  --tb-icon: var(--tbi-comments);
}
.icon-save {
  --tb-icon: var(--tbi-save);
}
.icon-search {
  --tb-icon: var(--tbi-search);
}
.icon-menu {
  --tb-icon: var(--tbi-menu);
}
.icon-outline {
  --tb-icon: var(--tbi-outline);
}
.icon-find-prev {
  --tb-icon: var(--tbi-find-prev);
}
.icon-find-next {
  --tb-icon: var(--tbi-find-next);
}

.tb-btn:hover:enabled {
  background: var(--button-hover);
}

.tb-btn.toggled {
  background: var(--toggled-bg);
  color: var(--toolbar-text);
}

.tb-btn.toggled:hover:enabled {
  background: var(--toggled-hover);
}

.tb-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.tb-btn:focus-visible,
.page-input:focus-visible,
.zoom-select:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.separator {
  width: 1px;
  height: 20px;
  margin: 0 6px;
  background: var(--separator);
}

.page-input {
  width: 40px;
  height: 24px;
  margin-left: 4px;
  border: 1px solid var(--field-border);
  border-radius: 4px;
  background: var(--field-bg);
  color: var(--toolbar-text);
  font-size: 13px;
  text-align: center;
}

.page-count {
  margin-left: 6px;
  color: var(--toolbar-muted);
  white-space: nowrap;
}

.zoom-select {
  height: 24px;
  min-width: 120px;
  margin-left: 4px;
  padding: 0 22px 0 8px;
  border: 1px solid var(--field-border);
  border-radius: 4px;
  appearance: none;
  background-color: var(--field-bg);
  background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='%238f8f9d' d='M8 10.8 2.6 5.4l1.1-1.1L8 8.6l4.3-4.3 1.1 1.1z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 6px center;
  background-size: 12px;
  color: var(--toolbar-text);
  font-size: 12px;
}

.status-hint {
  color: var(--toolbar-muted);
  font-size: 12px;
  white-space: nowrap;
}

.spacer {
  flex: 1;
}

.viewer-region {
  position: relative;
  flex: 1;
  min-height: 0;
}

/* PDFViewer requires an absolutely positioned container; the sidebar
   reserves its space via the container's inline-end inset. */
.viewer-scroll {
  position: absolute;
  inset: 0;
  overflow: auto;
  background: var(--body-bg);
}

.viewer-region.with-sidebar .viewer-scroll {
  inset-inline-end: 300px;
}

.pdfa-comments-sidebar {
  position: absolute;
  inset-block: 0;
  inset-inline-end: 0;
  width: 300px;
  overflow-y: auto;
  border-left: 1px solid var(--toolbar-border);
  background: var(--toolbar-bg);
  color: var(--toolbar-text);
  font-size: 13px;
}

.pdfa-comments-header {
  position: sticky;
  top: 0;
  padding: 10px 12px;
  background: var(--toolbar-bg);
  border-bottom: 1px solid var(--separator);
  font-weight: 600;
}

.pdfa-comments-empty {
  margin: 0;
  padding: 12px;
  color: var(--toolbar-muted);
}

.pdfa-comments-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.pdfa-comment-entry {
  display: block;
  width: 100%;
  padding: 10px 12px;
  border: 0;
  border-bottom: 1px solid var(--separator);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
}

.pdfa-comment-entry:hover {
  background: var(--button-hover);
}

.pdfa-comment-entry:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.pdfa-comment-meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.pdfa-comment-meta > span {
  color: var(--toolbar-muted);
  font-size: 12px;
  white-space: nowrap;
}

.pdfa-comment-date {
  display: block;
  margin-top: 1px;
  color: var(--toolbar-muted);
  font-size: 11px;
}

.pdfa-comment-body {
  display: block;
  margin-top: 4px;
  white-space: pre-wrap;
  overflow-wrap: break-word;
}

.viewer-region.with-outline .viewer-scroll {
  inset-inline-start: 260px;
}

.pdfa-outline {
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  width: 260px;
  overflow-y: auto;
  border-right: 1px solid var(--toolbar-border);
  background: var(--toolbar-bg);
  color: var(--toolbar-text);
  font-size: 13px;
}

.pdfa-outline-list {
  margin: 0;
  padding: 4px 0;
  list-style: none;
}

.pdfa-outline-entry {
  display: block;
  width: 100%;
  padding: 5px 12px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
  overflow-wrap: break-word;
}

.pdfa-outline-entry:hover {
  background: var(--button-hover);
}

.pdfa-findbar {
  position: absolute;
  top: 8px;
  inset-inline-start: 8px;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border: 1px solid var(--toolbar-border);
  border-radius: 6px;
  background: var(--toolbar-bg);
  color: var(--toolbar-text);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.pdfa-find-input {
  width: 200px;
  height: 26px;
  padding: 0 8px;
  border: 1px solid var(--field-border);
  border-radius: 4px;
  background: var(--field-bg);
  color: var(--toolbar-text);
  font-size: 13px;
}

.pdfa-find-input:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.pdfa-find-count {
  padding-inline: 6px;
  color: var(--toolbar-muted);
  font-size: 12px;
  white-space: nowrap;
}

.viewer-scroll.hand-tool {
  cursor: grab;
  user-select: none;
}

.viewer-scroll.hand-tool:active {
  cursor: grabbing;
}

.pdfa-menu-backdrop {
  position: absolute;
  inset: 0;
  z-index: 45;
}

.pdfa-menu {
  position: absolute;
  top: 4px;
  inset-inline-end: 4px;
  z-index: 46;
  display: flex;
  flex-direction: column;
  min-width: 250px;
  max-height: calc(100% - 16px);
  overflow-y: auto;
  padding: 4px;
  border: 1px solid var(--toolbar-border);
  border-radius: 6px;
  background: var(--toolbar-bg);
  color: var(--toolbar-text);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
  font-size: 13px;
}

.pdfa-menu button {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
  white-space: nowrap;
}

.pdfa-menu button:hover:enabled {
  background: var(--button-hover);
}

.pdfa-menu button.active {
  background: var(--toggled-bg);
}

.pdfa-menu button:disabled {
  opacity: 0.4;
  cursor: default;
}

.pdfa-menu-divider {
  height: 1px;
  margin: 4px 2px;
  background: var(--separator);
}

.pdfa-menu-icon {
  flex: 0 0 16px;
  width: 16px;
  height: 16px;
  background-color: currentColor;
  -webkit-mask: var(--mi-icon) center / contain no-repeat;
  mask: var(--mi-icon) center / contain no-repeat;
}

.mi-first-page {
  --mi-icon: var(--mi-first-page);
}
.mi-last-page {
  --mi-icon: var(--mi-last-page);
}
.mi-rotate-cw {
  --mi-icon: var(--mi-rotate-cw);
}
.mi-rotate-ccw {
  --mi-icon: var(--mi-rotate-ccw);
}
.mi-select-tool {
  --mi-icon: var(--mi-select-tool);
}
.mi-hand-tool {
  --mi-icon: var(--mi-hand-tool);
}
.mi-scroll-page {
  --mi-icon: var(--mi-scroll-page);
}
.mi-scroll-vertical {
  --mi-icon: var(--mi-scroll-vertical);
}
.mi-scroll-horizontal {
  --mi-icon: var(--mi-scroll-horizontal);
}
.mi-scroll-wrapped {
  --mi-icon: var(--mi-scroll-wrapped);
}
.mi-spread-none {
  --mi-icon: var(--mi-spread-none);
}
.mi-spread-odd {
  --mi-icon: var(--mi-spread-odd);
}
.mi-spread-even {
  --mi-icon: var(--mi-spread-even);
}
.mi-doc-props {
  --mi-icon: var(--mi-doc-props);
}
.mi-about {
  --mi-icon: var(--mi-about);
}

.error-banner {
  position: absolute;
  left: 50%;
  top: 16px;
  transform: translateX(-50%);
  max-width: min(90%, 640px);
  padding: 10px 16px;
  border-radius: 8px;
  background: #fdecea;
  border: 1px solid #f2b8b5;
  color: #8c1d18;
  font-size: 13px;
}

.pdfa-about-backdrop {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  background: rgba(0, 0, 0, 0.25);
}

.pdfa-about-dialog {
  margin-top: 12vh;
  width: min(420px, 90%);
  padding: 14px 16px;
  border: 1px solid var(--toolbar-border);
  border-radius: 8px;
  background: var(--toolbar-bg);
  color: var(--toolbar-text);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  font-size: 13px;
}

.pdfa-about-title {
  margin: 0 0 10px;
  font-size: 15px;
  font-weight: 600;
}

.pdfa-about-rows {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 5px 16px;
  margin: 0;
}

.pdfa-about-rows dt {
  color: var(--toolbar-muted);
}

.pdfa-about-rows dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.pdfa-about-mono {
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  user-select: all;
}

.pdfa-about-diagnostics {
  width: 100%;
  margin-top: 10px;
  padding: 6px 8px;
  border: 1px solid var(--field-border);
  border-radius: 4px;
  background: var(--field-bg);
  color: var(--toolbar-text);
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  font-size: 11px;
  resize: vertical;
}

.pdfa-about-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}

.pdfa-about-actions .pdfa-comment-spacer {
  flex: 1;
}

.pdfa-about-close,
.pdfa-about-diag {
  padding: 4px 12px;
  border: 1px solid var(--field-border);
  border-radius: 4px;
  background: var(--field-bg);
  color: var(--toolbar-text);
  font-size: 13px;
  cursor: pointer;
}

.pdfa-about-close:hover,
.pdfa-about-diag:hover {
  background: var(--button-hover);
}

.pdfa-about-close:focus-visible,
.pdfa-about-diag:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
</style>

<!-- Unscoped: the comment dialog/popup are created programmatically by the
     comment manager, so scoped attributes would not reach them. -->
<style>
.pdf-annotator .pdfa-comment-backdrop {
  position: absolute;
  inset: 0;
  z-index: 20;
  background: rgba(0, 0, 0, 0.1);
}

.pdf-annotator .pdfa-comment-backdrop.hidden,
.pdf-annotator .pdfa-comment-popup.hidden {
  display: none;
}

.pdf-annotator .pdfa-comment-dialog {
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: min(320px, 90%);
  padding: 12px;
  border: 1px solid var(--toolbar-border);
  border-radius: 8px;
  background: var(--toolbar-bg);
  color: var(--toolbar-text);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  font-family: system-ui, sans-serif;
  font-size: 13px;
}

.pdf-annotator .pdfa-comment-text {
  resize: vertical;
  min-height: 64px;
  padding: 6px 8px;
  border: 1px solid var(--field-border);
  border-radius: 4px;
  background: var(--field-bg);
  color: var(--toolbar-text);
  font: inherit;
}

.pdf-annotator .pdfa-comment-text:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.pdf-annotator .pdfa-comment-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pdf-annotator .pdfa-comment-spacer {
  flex: 1;
}

.pdf-annotator .pdfa-comment-actions button {
  padding: 4px 12px;
  border: 1px solid var(--field-border);
  border-radius: 4px;
  background: var(--field-bg);
  color: var(--toolbar-text);
  font-size: 13px;
  cursor: pointer;
}

.pdf-annotator .pdfa-comment-actions button:hover {
  background: var(--button-hover);
}

.pdf-annotator .pdfa-comment-actions .pdfa-comment-save {
  background: var(--accent);
  border-color: var(--accent);
  color: #ffffff;
  font-weight: 600;
}

.pdf-annotator .pdfa-comment-actions .pdfa-comment-delete {
  color: #c50042;
}

.pdf-annotator .pdfa-comment-actions .pdfa-comment-delete.hidden {
  display: none;
}

.pdf-annotator .pdfa-comment-popup {
  position: absolute;
  z-index: 15;
  max-width: 280px;
  padding: 8px 10px;
  border: 1px solid var(--toolbar-border);
  border-radius: 6px;
  background: var(--toolbar-bg);
  color: var(--toolbar-text);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  font-family: system-ui, sans-serif;
  font-size: 12px;
  white-space: pre-wrap;
  overflow-wrap: break-word;
}

/* pdf.js builds its per-annotation edit toolbar from buttons with generic
   class names (.buttons, .basic, .comment, .commentButton, .deleteButton,
   .highlightButton). Inside OpenCloud the extension shares the document
   with the runtime and every other enabled extension, and a global rule
   for one of those names (e.g. a comments app styling `.comment`) tears
   the buttons out of the toolbar or hides their icons — seen in
   production as empty toolbar cells with the bubble/trash icons pinned to
   the bottom of the viewer. Re-assert layout and icons with scoped
   !important rules so host stylesheets cannot displace them. */
.pdf-annotator :is(.annotationEditorLayer, .textLayer, .annotationLayer) .editToolbar {
  position: absolute !important;
  background: var(--toolbar-bg) !important;
  border: 1px solid var(--toolbar-border) !important;
  border-radius: 6px;
  box-shadow: 0 2px 6px 0 rgba(58, 57, 68, 0.2);
}

.pdf-annotator .editToolbar.hidden {
  display: none !important;
}

.pdf-annotator .editToolbar .buttons {
  display: flex !important;
  position: static !important;
  align-items: center;
  justify-content: center;
}

.pdf-annotator .editToolbar .buttons > .hidden {
  display: none !important;
}

.pdf-annotator
  .editToolbar
  .buttons
  > :is(.basic, .comment, .commentButton, .deleteButton, .highlightButton, .altText) {
  position: static !important;
  inset: auto !important;
  margin: 0 !important;
  transform: none !important;
  float: none !important;
}

.pdf-annotator
  .editToolbar
  .buttons
  > :is(.basic, .comment, .commentButton, .deleteButton, .highlightButton):not(.hidden) {
  display: block !important;
  width: var(--editor-toolbar-height, 28px) !important;
  height: var(--editor-toolbar-height, 28px) !important;
  min-width: 0 !important;
  min-height: 0 !important;
  max-width: none !important;
  max-height: none !important;
  padding: 0 !important;
  border: none !important;
  background-color: transparent;
  cursor: pointer;
}

.pdf-annotator .editToolbar .buttons .divider {
  position: static !important;
  display: inline-block !important;
  width: 1px !important;
  background-color: var(--separator) !important;
}

/* The color-picker button needs position:relative as anchor for its
   dropdown; the plain ink color swatch is a regular flow child. */
.pdf-annotator .editToolbar .buttons > .colorPicker {
  position: relative !important;
  inset: auto !important;
  margin: 0 !important;
  float: none !important;
}

.pdf-annotator .editToolbar .buttons > .basicColorPicker {
  position: static !important;
  inset: auto !important;
  margin: 0 !important;
  float: none !important;
}

.pdf-annotator .editToolbar .buttons > :not(.divider):hover {
  border-radius: 2px;
  background-color: var(--editor-toolbar-hover-bg-color, #e0e0e6);
}

/*
  Firefox (seen in production on FF 153) keeps painting pdf.js
  `-webkit-mask-image` icons for .editToolbar/.annotationCommentButton
  ::before pseudos at a displaced Y, even when the button box itself is
  correctly placed — leaving empty toolbar cells and "ghost" speech/trash
  icons floating below the highlight.

  Strategy:
  1. Kill the pdf.js ::before icon layer completely (content/mask/bg).
  2. Paint pre-tinted SVGs as background-image on the BUTTON element.
  Clear BOTH the standard and -webkit mask longhands; the `mask` shorthand
  alone is not enough in Firefox when pdf.js set `-webkit-mask-image`.
*/
.pdf-annotator
  .editToolbar
  .buttons
  > :is(.basic, .comment, .commentButton, .deleteButton, .highlightButton)::before,
.pdf-annotator
  .editToolbar
  .buttons
  > :is(.basic, .comment, .commentButton, .deleteButton, .highlightButton)::after {
  content: none !important;
  display: none !important;
  width: 0 !important;
  height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  background: none !important;
  background-image: none !important;
  -webkit-mask-image: none !important;
  mask-image: none !important;
  -webkit-mask: none !important;
  mask: none !important;
}

.pdf-annotator
  .editToolbar
  .buttons
  > :is(.comment, .commentButton, .deleteButton, .highlightButton) {
  background-repeat: no-repeat !important;
  background-position: center !important;
  background-size: 16px 16px !important;
}

.pdf-annotator .editToolbar .buttons > :is(.comment, .commentButton) {
  background-image: var(--pdfa-icon-comment) !important;
}

.pdf-annotator .editToolbar .buttons > .deleteButton {
  background-image: var(--pdfa-icon-delete) !important;
}

.pdf-annotator .editToolbar .buttons > .highlightButton {
  background-image: var(--pdfa-icon-highlight) !important;
}

@media (prefers-color-scheme: dark) {
  .pdf-annotator .editToolbar .buttons > :is(.comment, .commentButton) {
    background-image: var(--pdfa-icon-comment-invert) !important;
  }

  .pdf-annotator .editToolbar .buttons > .deleteButton {
    background-image: var(--pdfa-icon-delete-invert) !important;
  }

  .pdf-annotator .editToolbar .buttons > .highlightButton {
    background-image: var(--pdfa-icon-highlight-invert) !important;
  }
}

/* Standalone comment bubble on annotations that carry a comment. */
.pdf-annotator :is(.annotationLayer, .annotationEditorLayer) .annotationCommentButton {
  position: absolute !important;
  width: var(--comment-button-dim, 24px) !important;
  height: var(--comment-button-dim, 24px) !important;
  margin: 0 !important;
  transform: none !important;
  /* Always the gray tint: the bubble background is a light pastel mixed
     from the annotation color, independent of the host color scheme. */
  background-color: transparent !important;
  background-image: var(--pdfa-icon-comment) !important;
  background-repeat: no-repeat !important;
  background-position: center !important;
  background-size: 14px 14px !important;
}

.pdf-annotator
  :is(.annotationLayer, .annotationEditorLayer)
  .annotationCommentButton::before,
.pdf-annotator
  :is(.annotationLayer, .annotationEditorLayer)
  .annotationCommentButton::after {
  content: none !important;
  display: none !important;
  width: 0 !important;
  height: 0 !important;
  background: none !important;
  background-image: none !important;
  -webkit-mask-image: none !important;
  mask-image: none !important;
  -webkit-mask: none !important;
  mask: none !important;
}

.pdf-annotator .annotationLayer.disabled .annotationCommentButton {
  display: none !important;
}
</style>

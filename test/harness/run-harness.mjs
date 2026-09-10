#!/usr/bin/env node
// Browser smoke test for the OpenCloud integration of src/App.vue.
//
// Prerequisites: `pnpm exec vite --config vite.harness.config.ts` (port 5299)
// and a Chromium binary (defaults to the Playwright-managed install).
//
// Drives the real UI: renders a sample PDF, adds a FreeText note with mouse
// and keyboard, and asserts that the app emits the annotated PDF through the
// AppWrapper contract (update:currentContent + save).
import {chromium} from 'playwright-core';

const browser = await chromium.launch({
  executablePath: process.env.HARNESS_CHROMIUM ?? '/opt/pw-browsers/chromium',
});
const page = await browser.newPage({viewport: {width: 1280, height: 900}});
const consoleLines = [];
page.on('console', (msg) => consoleLines.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => consoleLines.push(`[pageerror] ${err.message}`));

const problems = [];
const check = (condition, message) => {
  if (!condition) problems.push(message);
};

try {
  await page.goto('http://localhost:5299/', {waitUntil: 'networkidle'});

  // 1. The sample PDF renders through the AppWrapper-style props.
  await page.waitForSelector('.pdfViewer .page canvas', {timeout: 20000});
  const pageCount = await page.textContent('.page-count');
  check(
    pageCount?.includes('von 2'),
    `page count should show "von 2", got "${pageCount}"`,
  );
  const initialZoom = await page.inputValue('.zoom-select');
  check(initialZoom === 'auto', `initial zoom should be "auto", got "${initialZoom}"`);
  check(
    (await page.locator('button[title="In OpenCloud speichern"]').count()) === 1,
    'toolbar should contain the OpenCloud save button',
  );

  // 2. Add a FreeText note via toolbar + click + keyboard.
  await page.click('button[title="Textnotiz einfügen"]');
  await page.waitForTimeout(300);
  const pdfPage = page.locator('.pdfViewer .page').first();
  await pdfPage.click({position: {x: 320, y: 240}});
  await page.keyboard.type('Prüfvermerk Protronic');
  // Blur commits the free text editor.
  await page.click('button[title="Auswahlwerkzeug"]');

  // 3. Wait for the debounced commit to emit the annotated PDF.
  await page.waitForFunction(() => window.__harness.emitted.length > 0, null, {
    timeout: 15000,
  });
  await page.waitForTimeout(2000);

  const state = await page.evaluate(() => window.__harness);
  check(state.emitted.length > 0, 'no update:currentContent emission received');
  const last = state.emitted[state.emitted.length - 1];
  const head = String.fromCharCode(...(last?.head ?? []));
  check(head === '%PDF-', `emitted bytes should start with %PDF-, got "${head}"`);
  check(
    (last?.length ?? 0) > 500,
    `emitted PDF suspiciously small: ${last?.length} bytes`,
  );

  // 4. The emitted bytes parse as a PDF and contain the FreeText annotation.
  const verification = await page.evaluate(() => window.__verifyEmitted());
  check(verification.numPages === 2, `emitted PDF should keep 2 pages, got ${verification.numPages}`);
  check(
    verification.annotationSubtypes.includes('FreeText'),
    `emitted PDF should contain a FreeText annotation, got [${verification.annotationSubtypes.join(', ')}]`,
  );

  // 5. Draw an ink stroke and attach a comment via the editor toolbar
  // (free text carries its content itself; comments exist for highlight,
  // ink and stamp annotations, matching the pdf.js viewer).
  await page.click('button[title="Freihand zeichnen"]');
  await page.waitForTimeout(300);
  const inkBox = await page.locator('.pdfViewer .page').first().boundingBox();
  await page.mouse.move(inkBox.x + 200, inkBox.y + 420);
  await page.mouse.down();
  for (let step = 1; step <= 8; step++) {
    await page.mouse.move(inkBox.x + 200 + step * 14, inkBox.y + 420 + (step % 2 ? 12 : -12));
  }
  await page.mouse.up();
  await page.waitForTimeout(300);
  // Leaving the mode commits the stroke; re-entering makes editors selectable.
  await page.click('button[title="Auswahlwerkzeug"]');
  await page.waitForTimeout(400);
  await page.click('button[title="Freihand zeichnen"]');
  await page.waitForTimeout(400);
  await page.locator('.inkEditor').first().click();
  await page.waitForSelector('.editToolbar button.comment', {timeout: 5000});
  await page.click('.editToolbar button.comment');
  await page.waitForSelector('.pdfa-comment-dialog', {timeout: 5000});
  await page.fill('.pdfa-comment-text', 'Bitte bis Freitag prüfen');
  await page.click('.pdfa-comment-save');
  await page.click('button[title="Auswahlwerkzeug"]');
  const emittedBefore = await page.evaluate(() => window.__harness.emitted.length);
  await page.waitForFunction(
    (count) => window.__harness.emitted.length > count,
    emittedBefore - 1,
    {timeout: 15000},
  );
  await page.waitForTimeout(2000);
  const commented = await page.evaluate(() => window.__verifyEmitted());
  check(
    commented.annotationContents.some((entry) => entry.includes('Bitte bis Freitag prüfen')),
    `emitted PDF should carry the comment text, got [${commented.annotationContents.join(' | ')}]`,
  );
  check(
    commented.annotationAuthors.some((entry) => entry.includes('Harness User')),
    `emitted PDF should store the OpenCloud user as /T, got [${commented.annotationAuthors.join(' | ')}]`,
  );

  // 5b. Add a signature through the signature-manager dialog (type tab).
  await page.click('button[title="Unterschrift hinzufügen"]');
  await page.waitForTimeout(600);
  if ((await page.locator('.pdfa-sign-backdrop:not(.hidden)').count()) === 0) {
    // The pending editor may need a click on the page to spawn.
    await page.locator('.pdfViewer .page').first().click({position: {x: 260, y: 520}});
  }
  await page.waitForSelector('.pdfa-sign-backdrop:not(.hidden)', {timeout: 5000});
  await page.fill('.pdfa-sign-type-input', 'Max Mustermann');
  const beforeSignature = await page.evaluate(() => ({
    emitted: window.__harness.emitted.length,
  }));
  const annotationsBeforeSignature = commented.annotationSubtypes.length;
  await page.click('.pdfa-sign-add');
  await page.waitForSelector('.signatureEditor', {timeout: 5000});
  await page.click('button[title="Auswahlwerkzeug"]');
  await page.waitForFunction(
    (count) => window.__harness.emitted.length > count,
    beforeSignature.emitted,
    {timeout: 15000},
  );
  await page.waitForTimeout(1500);
  const signed = await page.evaluate(() => window.__verifyEmitted());
  check(
    signed.annotationSubtypes.length > annotationsBeforeSignature,
    `signature should add an annotation, got [${signed.annotationSubtypes.join(', ')}]`,
  );

  // 5c. Freehand strokes must reach the document WITHOUT switching tools:
  // the open drawing session commits after an idle pause and autosave
  // picks it up.
  const inkCountBefore = (await page.evaluate(() => window.__verifyEmitted()))
    .annotationSubtypes.filter((subtype) => subtype === 'Ink').length;
  await page.click('button[title="Freihand zeichnen"]');
  await page.waitForTimeout(300);
  const idleInkBox = await page.locator('.pdfViewer .page').first().boundingBox();
  await page.mouse.move(idleInkBox.x + 120, idleInkBox.y + 600);
  await page.mouse.down();
  for (let step = 1; step <= 6; step++) {
    await page.mouse.move(idleInkBox.x + 120 + step * 16, idleInkBox.y + 600 + (step % 2 ? 10 : -10));
  }
  await page.mouse.up();
  const emittedBeforeIdle = await page.evaluate(() => window.__harness.emitted.length);
  // Stay in the ink tool - no click on the select tool here.
  await page.waitForFunction(
    (count) => window.__harness.emitted.length > count,
    emittedBeforeIdle,
    {timeout: 15000},
  );
  await page.waitForTimeout(500);
  const idleVerify = await page.evaluate(() => window.__verifyEmitted());
  const inkCountAfter = idleVerify.annotationSubtypes.filter(
    (subtype) => subtype === 'Ink',
  ).length;
  check(
    inkCountAfter > inkCountBefore,
    `idle-committed stroke should reach the saved PDF without a tool switch (Ink ${inkCountBefore} -> ${inkCountAfter})`,
  );
  await page.click('button[title="Auswahlwerkzeug"]');
  await page.waitForTimeout(300);

  // 6. The pdf.js-style zoom select drives the viewer scale.
  await page.selectOption('.zoom-select', '1');
  await page.waitForTimeout(400);
  const zoomValue = await page.inputValue('.zoom-select');
  check(zoomValue === '1', `zoom select should hold "1" (100 %), got "${zoomValue}"`);

  // 6b. Ctrl+wheel zooms the document (and does not stay on the preset).
  const viewerBox = await page.locator('.viewer-scroll').boundingBox();
  await page.mouse.move(viewerBox.x + viewerBox.width / 2, viewerBox.y + 200);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -300);
  await page.keyboard.up('Control');
  await page.waitForTimeout(400);
  const wheelZoom = await page.inputValue('.zoom-select');
  check(
    wheelZoom === 'custom' || Number.parseFloat(wheelZoom) > 1,
    `ctrl+wheel should zoom in (custom scale), zoom select shows "${wheelZoom}"`,
  );

  // 6c. The explicit save button commits and triggers the wrapper save.
  await page.click('button[title="In OpenCloud speichern"]');
  await page.waitForFunction(() => window.__harness.saves > 0, null, {timeout: 10000});

  // 6c2. Saving right after an edit - while the editor is still active and
  // an autosave commit may be in flight - must take the change over into
  // the document BEFORE the save event fires (no stale-save race).
  await page.click('button[title="Textnotiz einfügen"]');
  await page.waitForTimeout(300);
  await page.locator('.pdfViewer .page').first().click({position: {x: 320, y: 340}});
  await page.keyboard.type('Schnellspeichernotiz');
  const savesBeforeQuick = await page.evaluate(() => window.__harness.saves);
  await page.click('button[title="In OpenCloud speichern"]');
  await page.waitForFunction(
    (count) => window.__harness.saves > count,
    savesBeforeQuick,
    {timeout: 15000},
  );
  await page.waitForTimeout(1500);
  const quickSave = await page.evaluate(() => ({
    emitted: window.__harness.emitted.length,
    atSave: window.__harness.saveEmitCounts.at(-1),
  }));
  check(
    quickSave.atSave === quickSave.emitted,
    `save event must come after the final emission (emitted ${quickSave.emitted}, at save ${quickSave.atSave})`,
  );
  const quickVerify = await page.evaluate(() => window.__verifyEmitted());
  check(
    quickVerify.annotationContents.some((entry) => entry.includes('Schnellspeichernotiz')),
    `the quick-saved PDF must contain the fresh note, got [${quickVerify.annotationContents.join(' | ')}]`,
  );
  await page.click('button[title="Auswahlwerkzeug"]');
  await page.waitForTimeout(300);

  // 6d. The search bar finds text across pages.
  await page.click('button[title="Suchen"]');
  await page.waitForSelector('.pdfa-find-input', {timeout: 5000});
  await page.fill('.pdfa-find-input', 'Testseite');
  await page.waitForFunction(
    () => document.querySelector('.pdfa-find-count')?.textContent?.includes('von 2'),
    null,
    {timeout: 10000},
  );
  await page.click('button[title="Suchen"]');

  // 6e. The secondary menu offers the original viewer tools.
  await page.click('button[title="Werkzeuge"]');
  await page.waitForSelector('.pdfa-menu', {timeout: 5000});
  const menuText = await page.textContent('.pdfa-menu');
  for (const item of ['Letzte Seite anzeigen', 'Hand-Werkzeug', 'Kombinierte Seitenanordnung', 'Drucken', 'Seiten verwalten', 'Dokumenteigenschaften']) {
    check(menuText?.includes(item), `secondary menu should offer "${item}"`);
  }

  // 7. The about dialog surfaces the injected build metadata (via the menu).
  await page.click('.pdfa-menu >> text=Über PDF Annotator');
  await page.waitForSelector('.pdfa-about-dialog', {timeout: 5000});
  const aboutText = await page.textContent('.pdfa-about-dialog');
  check(
    aboutText?.includes('Git-Commit') && !aboutText.includes('unbekannt'),
    `about dialog should show a git commit, got "${aboutText}"`,
  );
  check(
    aboutText?.includes('Harness User'),
    `about dialog should show the detected user, got "${aboutText}"`,
  );
  await page.click('.pdfa-about-close');
  await page.waitForTimeout(200);
  check(
    (await page.locator('.pdfa-about-dialog').count()) === 0,
    'about dialog should close again',
  );

  // 8. The comment sidebar summarizes the document's comments.
  await page.click('button[title="Kommentare"]');
  await page.waitForSelector('.pdfa-comments-sidebar', {timeout: 5000});
  await page.waitForTimeout(500);
  const sidebarText = await page.textContent('.pdfa-comments-sidebar');
  check(
    sidebarText?.includes('Bitte bis Freitag prüfen'),
    `comment sidebar should list the ink comment, got "${sidebarText}"`,
  );
  check(
    sidebarText?.includes('Harness User'),
    `comment sidebar should show the OpenCloud user, got "${sidebarText}"`,
  );
  check(
    sidebarText?.includes('Seite 1'),
    `comment sidebar should show the page number, got "${sidebarText}"`,
  );
  await page.click('.pdfa-comment-entry');
  await page.waitForTimeout(300);
  await page.click('button[title="Kommentare"]');
  await page.waitForTimeout(200);
  check(
    (await page.locator('.pdfa-comments-sidebar').count()) === 0,
    'comment sidebar should close again',
  );

  // 9. Views sidebar: thumbnails render; duplicating page 1 grows the saved
  // PDF to 3 pages, deleting the copy shrinks it back - both through the
  // extractPages-based save path.
  await page.click('button[title="Werkzeuge"]');
  await page.waitForSelector('.pdfa-menu', {timeout: 5000});
  await page.click('.pdfa-menu >> text=Seiten verwalten');
  await page.waitForSelector('.pdfa-views', {timeout: 5000});
  await page.waitForSelector('.pdfa-thumb img', {timeout: 30000});
  const thumbCount = await page.locator('.pdfa-thumb').count();
  check(thumbCount === 2, `sidebar should show 2 page thumbnails, got ${thumbCount}`);
  await page.locator('.pdfa-thumb-check input').first().check();
  const beforeDuplicate = await page.evaluate(() => window.__harness.emitted.length);
  await page.click('.pdfa-pages-duplicate');
  await page.waitForTimeout(400);
  const countAfterDuplicate = await page.textContent('.page-count');
  check(
    countAfterDuplicate?.includes('von 3'),
    `duplicating a page should show "von 3", got "${countAfterDuplicate}"`,
  );
  await page.waitForFunction(
    (count) => window.__harness.emitted.length > count,
    beforeDuplicate,
    {timeout: 20000},
  );
  await page.waitForTimeout(1000);
  const duplicated = await page.evaluate(() => window.__verifyEmitted());
  check(
    duplicated.numPages === 3,
    `saved PDF should hold 3 pages after duplicating, got ${duplicated.numPages}`,
  );
  // Delete the copy (page 2) again - the thumbnails were rebuilt for the
  // new page arrangement first.
  await page.waitForFunction(
    () => document.querySelectorAll('.pdfa-thumb').length === 3,
    null,
    {timeout: 10000},
  );
  await page.locator('.pdfa-thumb-check input').nth(1).check();
  const beforeDelete = await page.evaluate(() => window.__harness.emitted.length);
  await page.click('.pdfa-pages-delete');
  await page.waitForTimeout(400);
  const countAfterDelete = await page.textContent('.page-count');
  check(
    countAfterDelete?.includes('von 2'),
    `deleting the copy should show "von 2", got "${countAfterDelete}"`,
  );
  await page.waitForFunction(
    (count) => window.__harness.emitted.length > count,
    beforeDelete,
    {timeout: 20000},
  );
  await page.waitForTimeout(1000);
  const shrunk = await page.evaluate(() => window.__verifyEmitted());
  check(
    shrunk.numPages === 2,
    `saved PDF should hold 2 pages after deleting the copy, got ${shrunk.numPages}`,
  );

  // 9b. The view selector switches to the document outline view.
  await page.click('.pdfa-views-select-btn');
  await page.waitForSelector('.pdfa-views-menu', {timeout: 5000});
  await page.click('.pdfa-views-menu >> text=Dokumentstruktur');
  const viewsTitle = await page.textContent('.pdfa-views-title');
  check(
    viewsTitle?.includes('Dokumentstruktur'),
    `view selector should switch to the outline view, got "${viewsTitle}"`,
  );
  await page.click('button[title="Seitenleiste"]');
  await page.waitForTimeout(200);
  check(
    (await page.locator('.pdfa-views').count()) === 0,
    'views sidebar should close again',
  );

  const errors = await page.evaluate(() => window.__harness.errors);
  check(errors.length === 0, `page errors: ${errors.join(' | ')}`);
} catch (error) {
  problems.push(`harness run failed: ${error.message}`);
}

if (problems.length) {
  console.error(`✗ pdf-annotator harness\n  ${problems.join('\n  ')}`);
  console.error(consoleLines.join('\n'));
} else {
  console.log('✓ pdf-annotator harness: render, annotate, comment, signature, ink-idle-commit, emit, verify, zoom, save, quick-save, find, menu, about, sidebar, thumbnails, pages, views');
}

await browser.close();
process.exit(problems.length ? 1 : 0);

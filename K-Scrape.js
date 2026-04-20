// Amazon "Manage Your Content" scraper bookmarklet (Kindle + Audible tabs).
// Accumulates minimal per-book HTML across paginated pages into IndexedDB,
// then copies one consolidated HTML blob to the clipboard for /purchases/import.
//
// Storage: IndexedDB (DB="klScrape", store="books"). localStorage was hitting
// its ~5MB cap because Amazon fills it heavily on mycd. IndexedDB quota is
// effectively unbounded for this workload.
//
// Dedup key: ASIN (suffix of content-image-{ASIN}). Present on both Kindle
// and Audible containers, so the same bookmarklet works on both tabs and
// cross-tab re-clicks are no-ops.
//
// Emitted stub satisfies both parseKindleHtml and parseAudibleHtml:
//   - Kindle wants [id^="content-title-"] [role="heading"], [id^="content-author-"]
//   - Audible wants .digital_entity_title, .digital_entity_details with
//     .information_row children in author/date/owner order
// Each emitted container carries both shapes so either parser finds what it
// needs. ASIN flows through via the preserved content-image-{ASIN} id.
//
// Usage:
//   1. Create a browser bookmark whose URL is the single-line javascript:
//      payload at the bottom of this file.
//   2. On amazon.com/hz/mycd (Books or Audiobooks tab), click the bookmark on
//      each page → Cancel to keep paginating, OK on the last page to copy.
//   3. Paste into /purchases/import → pick Kindle HTML or Audible HTML.
//   4. Reset mid-run from DevTools: indexedDB.deleteDatabase('klScrape')
//
// Readable source:

(async function () {
  const DB = 'klScrape';
  const STORE = 'books';

  const openDb = () =>
    new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

  const tx = (db, mode) => db.transaction(STORE, mode).objectStore(STORE);
  const asPromise = (req) =>
    new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

  const db = await openDb();
  const existing = new Set(await asPromise(tx(db, 'readonly').getAllKeys()));
  const containers = document.querySelectorAll(
    '[class*="DigitalEntitySummary-module__container"]'
  );
  const esc = (s) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  let added = 0;

  for (const c of containers) {
    const imgWrapper = c.querySelector('[id^="content-image-"]');
    if (!imgWrapper) continue;
    const asin = imgWrapper.id.replace(/^content-image-/, '');
    if (!asin || existing.has(asin)) continue;

    // Title: Kindle uses [id^="content-title-"] [role="heading"],
    // Audible uses .digital_entity_title. Prefer the Kindle one when present.
    const titleEl =
      c.querySelector('[id^="content-title-"] [role="heading"]') ??
      c.querySelector('.digital_entity_title');
    if (!titleEl) continue;
    const title = titleEl.textContent.replace(/\s+/g, ' ').trim();
    if (!title) continue;

    // Authors: Kindle uses [id^="content-author-"] directly; Audible's first
    // plain .information_row (excluding tag/date/owner rows).
    let authors =
      c.querySelector('[id^="content-author-"]')?.textContent.trim() ?? '';
    if (!authors) {
      for (const r of c.querySelectorAll('.information_row')) {
        if (r.querySelector('i')) continue;
        const t = r.textContent.replace(/\s+/g, ' ').trim();
        if (!t) continue;
        if (/^Acquired on\b/i.test(t)) continue;
        if (/^(Acquired by|Shared with)\b/i.test(t)) continue;
        authors = t;
        break;
      }
    }

    const imgSrc = imgWrapper.querySelector('img')?.getAttribute('src') ?? '';
    const date =
      c.querySelector('[id^="content-acquired-date-"]')?.textContent
        .replace(/\s+/g, ' ')
        .trim() ?? '';

    const ownerLines = [];
    for (const r of c.querySelectorAll('.information_row')) {
      const t = r.textContent.replace(/\s+/g, ' ').trim();
      if (/^(Acquired by|Shared with)\b/i.test(t)) ownerLines.push(t);
    }

    // Emit a hybrid stub that both parsers can read. Wrapping the title div
    // with both content-title-{ASIN} id AND .digital_entity_title class lets
    // either parser find it and recover the ASIN.
    const html =
      '<div class="DigitalEntitySummary-module__container">' +
      `<div id="content-image-${asin}"><img src="${escAttr(imgSrc)}"/></div>` +
      '<div class="digital_entity_details">' +
      `<div id="content-title-${asin}" class="digital_entity_title"><div role="heading">${esc(title)}</div></div>` +
      (authors ? `<div id="content-author-${asin}" class="information_row">${esc(authors)}</div>` : '') +
      (date ? `<div id="content-acquired-date-${asin}" class="information_row">${esc(date)}</div>` : '') +
      ownerLines.map((t) => `<div class="information_row">${esc(t)}</div>`).join('') +
      '</div>' +
      '</div>';

    await asPromise(tx(db, 'readwrite').put(html, asin));
    added++;
  }

  const all = await asPromise(tx(db, 'readonly').getAll());
  const total = all.length;
  if (confirm(`Page: +${added}. Total: ${total}\n\nOK=copy+reset. Cancel=keep paginating.`)) {
    const out = '<html><body>' + all.join('\n') + '</body></html>';
    await navigator.clipboard.writeText(out);
    await asPromise(tx(db, 'readwrite').clear());
    alert(`Copied ${total} books.`);
  }
})();

/*
Bookmarklet URL (paste as the bookmark's URL — single line):

javascript:(async function(){const DB='klScrape',ST='books';const op=()=>new Promise((s,j)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(ST);r.onsuccess=()=>s(r.result);r.onerror=()=>j(r.error);});const tx=(db,m)=>db.transaction(ST,m).objectStore(ST);const rq=r=>new Promise((s,j)=>{r.onsuccess=()=>s(r.result);r.onerror=()=>j(r.error);});const db=await op();const ex=new Set(await rq(tx(db,'readonly').getAllKeys()));const C=document.querySelectorAll('[class*="DigitalEntitySummary-module__container"]');const h=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');const q=s=>s.replace(/&/g,'&amp;').replace(/"/g,'&quot;');let a=0;for(const c of C){const iW=c.querySelector('[id^="content-image-"]');if(!iW)continue;const asin=iW.id.replace(/^content-image-/,'');if(!asin||ex.has(asin))continue;const tE=c.querySelector('[id^="content-title-"] [role="heading"]')||c.querySelector('.digital_entity_title');if(!tE)continue;const ti=tE.textContent.replace(/\s+/g,' ').trim();if(!ti)continue;let au=c.querySelector('[id^="content-author-"]')?.textContent.trim()||'';if(!au){for(const r of c.querySelectorAll('.information_row')){if(r.querySelector('i'))continue;const t=r.textContent.replace(/\s+/g,' ').trim();if(!t)continue;if(/^Acquired on\b/i.test(t))continue;if(/^(Acquired by|Shared with)\b/i.test(t))continue;au=t;break;}}const iS=iW.querySelector('img')?.getAttribute('src')||'';const d=c.querySelector('[id^="content-acquired-date-"]')?.textContent.replace(/\s+/g,' ').trim()||'';const rs=[];for(const r of c.querySelectorAll('.information_row')){const t=r.textContent.replace(/\s+/g,' ').trim();if(/^(Acquired by|Shared with)\b/i.test(t))rs.push(t);}const html='<div class="DigitalEntitySummary-module__container"><div id="content-image-'+asin+'"><img src="'+q(iS)+'"/></div><div class="digital_entity_details"><div id="content-title-'+asin+'" class="digital_entity_title"><div role="heading">'+h(ti)+'</div></div>'+(au?'<div id="content-author-'+asin+'" class="information_row">'+h(au)+'</div>':'')+(d?'<div id="content-acquired-date-'+asin+'" class="information_row">'+h(d)+'</div>':'')+rs.map(t=>'<div class="information_row">'+h(t)+'</div>').join('')+'</div></div>';await rq(tx(db,'readwrite').put(html,asin));a++;}const all=await rq(tx(db,'readonly').getAll());const t=all.length;if(confirm('Page: +'+a+'. Total: '+t+'\n\nOK=copy+reset. Cancel=keep paginating.')){const ht='<html><body>'+all.join('\n')+'</body></html>';await navigator.clipboard.writeText(ht);await rq(tx(db,'readwrite').clear());alert('Copied '+t+' books.');}})();
*/

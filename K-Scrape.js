// Kindle / Audible library scraper bookmarklet.
// Accumulates minimal per-book HTML across paginated Amazon "Manage Your Content"
// pages into IndexedDB, then copies one consolidated HTML blob to the clipboard
// for /purchases/import.
//
// Storage: IndexedDB (DB="klScrape", store="books"). localStorage was hitting
// its ~5MB cap because Amazon fills it heavily on mycd. IndexedDB quota is
// effectively unbounded for this workload.
//
// Usage:
//   1. Create a browser bookmark whose URL is the single-line javascript:
//      payload at the bottom of this file.
//   2. On amazon.com/hz/mycd (Books or Audiobooks tab), click the bookmark on
//      each page → Cancel to keep paginating, OK on the last page to copy.
//   3. Paste into /purchases/import → pick Kindle HTML or Audible HTML.
//   4. Dedup is by content-title-* id; re-clicking the same page is a no-op.
//   5. Reset mid-run from DevTools: indexedDB.deleteDatabase('klScrape')
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
    const titleEl = c.querySelector('[id^="content-title-"] [role="heading"]');
    if (!titleEl) continue;
    const id = titleEl.closest('[id^="content-title-"]').id;
    if (existing.has(id)) continue;

    const title = titleEl.textContent.replace(/\s+/g, ' ').trim();
    const authors =
      c.querySelector('[id^="content-author-"]')?.textContent.trim() ?? '';
    const image =
      c.querySelector('[id^="content-image-"] img')?.getAttribute('src') ?? '';
    const date =
      c.querySelector('[id^="content-acquired-date-"]')?.textContent.trim() ?? '';
    const rows = [];
    for (const r of c.querySelectorAll('.information_row')) {
      const t = r.textContent.trim();
      if (/^(Acquired by|Shared with)\b/i.test(t)) rows.push(t);
    }

    const html =
      '<div class="DigitalEntitySummary-module__container">' +
      `<div id="${id}"><div role="heading">${esc(title)}</div></div>` +
      (authors ? `<div id="content-author-x">${esc(authors)}</div>` : '') +
      (image ? `<div id="content-image-x"><img src="${escAttr(image)}"/></div>` : '') +
      (date ? `<div id="content-acquired-date-x">${esc(date)}</div>` : '') +
      rows.map((t) => `<div class="information_row">${esc(t)}</div>`).join('') +
      '</div>';

    await asPromise(tx(db, 'readwrite').put(html, id));
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

javascript:(async function(){const DB='klScrape',ST='books';const op=()=>new Promise((s,j)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(ST);r.onsuccess=()=>s(r.result);r.onerror=()=>j(r.error);});const tx=(db,m)=>db.transaction(ST,m).objectStore(ST);const rq=r=>new Promise((s,j)=>{r.onsuccess=()=>s(r.result);r.onerror=()=>j(r.error);});const db=await op();const ex=new Set(await rq(tx(db,'readonly').getAllKeys()));const C=document.querySelectorAll('[class*="DigitalEntitySummary-module__container"]');const h=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');const q=s=>s.replace(/&/g,'&amp;').replace(/"/g,'&quot;');let a=0;for(const c of C){const tE=c.querySelector('[id^="content-title-"] [role="heading"]');if(!tE)continue;const id=tE.closest('[id^="content-title-"]').id;if(ex.has(id))continue;const ti=tE.textContent.replace(/\s+/g,' ').trim();const au=c.querySelector('[id^="content-author-"]')?.textContent.trim()||'';const im=c.querySelector('[id^="content-image-"] img')?.getAttribute('src')||'';const d=c.querySelector('[id^="content-acquired-date-"]')?.textContent.trim()||'';const rs=[];for(const r of c.querySelectorAll('.information_row')){const t=r.textContent.trim();if(/^(Acquired by|Shared with)\b/i.test(t))rs.push(t);}const html='<div class="DigitalEntitySummary-module__container"><div id="'+id+'"><div role="heading">'+h(ti)+'</div></div>'+(au?'<div id="content-author-x">'+h(au)+'</div>':'')+(im?'<div id="content-image-x"><img src="'+q(im)+'"/></div>':'')+(d?'<div id="content-acquired-date-x">'+h(d)+'</div>':'')+rs.map(t=>'<div class="information_row">'+h(t)+'</div>').join('')+'</div>';await rq(tx(db,'readwrite').put(html,id));a++;}const all=await rq(tx(db,'readonly').getAll());const t=all.length;if(confirm('Page: +'+a+'. Total: '+t+'\n\nOK=copy+reset. Cancel=keep paginating.')){const ht='<html><body>'+all.join('\n')+'</body></html>';await navigator.clipboard.writeText(ht);await rq(tx(db,'readwrite').clear());alert('Copied '+t+' books.');}})();
*/

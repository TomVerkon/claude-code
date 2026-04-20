// audible.com library scraper bookmarklet (enrichment).
// Accumulates per-book {asin, title, authors, series, description} across the
// paginated audible.com/library/titles pages into IndexedDB, then copies one
// consolidated HTML blob to the clipboard for /purchases/enrich.
//
// The Amazon "Manage Your Content" page (handled by K-Scrape) has patchy
// series/description data — often just a bare title. audible.com's library
// page has structured series and a full marketing summary, so we scrape it
// separately and merge into existing rows keyed by ASIN.
//
// Storage: IndexedDB (DB="aScrape", store="books"). Separate DB from K-Scrape
// so the two bookmarklets don't step on each other.
//
// Dedup key: ASIN. Duplicate clicks on the same page, or re-running from
// page 1 mid-run, are no-ops.
//
// Emitted stub (per book):
//   <div class="kscrape-audible-enrich" data-asin="B0F7WPLK5J">
//     <div class="kscrape-title">...</div>
//     <div class="kscrape-authors">...</div>
//     <div class="kscrape-series">...</div>    (optional)
//     <div class="kscrape-description">...</div>  (optional)
//   </div>
//
// Usage:
//   1. Create a browser bookmark whose URL is the single-line javascript:
//      payload at the bottom of this file.
//   2. Log into audible.com → Library → Titles. Click the bookmark on each
//      page → Cancel to keep paginating, OK on the last page to copy.
//   3. Paste into /purchases/enrich.
//   4. Reset mid-run from DevTools: indexedDB.deleteDatabase('aScrape')
//
// Readable source:

(async function () {
  const DB = 'aScrape';
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
  const rows = document.querySelectorAll('.adbl-library-content-row');
  const esc = (s) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const collapse = (s) => s.replace(/\s+/g, ' ').trim();
  let added = 0;

  for (const row of rows) {
    // ASIN: prefer an href like /pd/...-Audiobook/{ASIN}?... Fall back to
    // a checkbox with data-asin. Row id suffix is NOT the ASIN on audible.com.
    let asin = '';
    const pdLink = row.querySelector('a[href*="/pd/"][href*="-Audiobook/"]');
    if (pdLink) {
      const m = pdLink.getAttribute('href').match(/-Audiobook\/([A-Z0-9]{10})/);
      if (m) asin = m[1];
    }
    if (!asin) {
      const cb = row.querySelector('input[data-asin]');
      if (cb) asin = cb.getAttribute('data-asin') || '';
    }
    if (!asin || existing.has(asin)) continue;

    const titleEl = row.querySelector('.bc-size-headline3');
    const title = titleEl ? collapse(titleEl.textContent) : '';
    if (!title) continue;

    // Authors: gather all <a> inside .authorLabel span.
    let authors = '';
    const authorLabel = row.querySelector('.authorLabel');
    if (authorLabel) {
      const links = authorLabel.querySelectorAll('a');
      if (links.length) {
        authors = Array.from(links).map((a) => collapse(a.textContent)).join(', ');
      } else {
        // Rare: no link, just text "By: Name"
        authors = collapse(authorLabel.textContent).replace(/^By:\s*/i, '');
      }
    }

    // Series: .seriesLabel contains <a>{series name}</a>, a comma text node,
    // and a <span class="bc-text">Book N</span>. Combine as "{Name} Book N".
    let series = '';
    const seriesLabel = row.querySelector('.seriesLabel');
    if (seriesLabel) {
      const seriesLink = seriesLabel.querySelector('a');
      const seriesName = seriesLink ? collapse(seriesLink.textContent) : '';
      const spans = seriesLabel.querySelectorAll('span.bc-text');
      // Last such span is the "Book N" one (the outer Series: wrapper span
      // also matches but has children, while the book-num span has only text).
      let bookNum = '';
      for (const sp of spans) {
        const t = collapse(sp.textContent);
        if (/^Books?\s+[\d-]+$/i.test(t)) {
          bookNum = t;
          break;
        }
      }
      if (seriesName) {
        series = bookNum ? `${seriesName} ${bookNum}` : seriesName;
      }
    }

    // Description: .merchandisingSummary — strip inner tags, collapse.
    let description = '';
    const summary = row.querySelector('.merchandisingSummary');
    if (summary) description = collapse(summary.textContent);

    const html =
      `<div class="kscrape-audible-enrich" data-asin="${escAttr(asin)}">` +
      `<div class="kscrape-title">${esc(title)}</div>` +
      (authors ? `<div class="kscrape-authors">${esc(authors)}</div>` : '') +
      (series ? `<div class="kscrape-series">${esc(series)}</div>` : '') +
      (description ? `<div class="kscrape-description">${esc(description)}</div>` : '') +
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
    alert(`Copied ${total} enrichment records.`);
  }
})();

/*
Bookmarklet URL (paste as the bookmark's URL — single line):

javascript:(async function(){const DB='aScrape',ST='books';const op=()=>new Promise((s,j)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(ST);r.onsuccess=()=>s(r.result);r.onerror=()=>j(r.error);});const tx=(db,m)=>db.transaction(ST,m).objectStore(ST);const rq=r=>new Promise((s,j)=>{r.onsuccess=()=>s(r.result);r.onerror=()=>j(r.error);});const db=await op();const ex=new Set(await rq(tx(db,'readonly').getAllKeys()));const R=document.querySelectorAll('.adbl-library-content-row');const h=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');const q=s=>s.replace(/&/g,'&amp;').replace(/"/g,'&quot;');const co=s=>s.replace(/\s+/g,' ').trim();let a=0;for(const row of R){let asin='';const pd=row.querySelector('a[href*="/pd/"][href*="-Audiobook/"]');if(pd){const m=pd.getAttribute('href').match(/-Audiobook\/([A-Z0-9]{10})/);if(m)asin=m[1];}if(!asin){const cb=row.querySelector('input[data-asin]');if(cb)asin=cb.getAttribute('data-asin')||'';}if(!asin||ex.has(asin))continue;const tE=row.querySelector('.bc-size-headline3');const ti=tE?co(tE.textContent):'';if(!ti)continue;let au='';const aL=row.querySelector('.authorLabel');if(aL){const ls=aL.querySelectorAll('a');if(ls.length)au=Array.from(ls).map(x=>co(x.textContent)).join(', ');else au=co(aL.textContent).replace(/^By:\s*/i,'');}let se='';const sL=row.querySelector('.seriesLabel');if(sL){const sLn=sL.querySelector('a');const sN=sLn?co(sLn.textContent):'';const sp=sL.querySelectorAll('span.bc-text');let bN='';for(const s of sp){const t=co(s.textContent);if(/^Books?\s+[\d-]+$/i.test(t)){bN=t;break;}}if(sN)se=bN?sN+' '+bN:sN;}let de='';const sum=row.querySelector('.merchandisingSummary');if(sum)de=co(sum.textContent);const html='<div class="kscrape-audible-enrich" data-asin="'+q(asin)+'"><div class="kscrape-title">'+h(ti)+'</div>'+(au?'<div class="kscrape-authors">'+h(au)+'</div>':'')+(se?'<div class="kscrape-series">'+h(se)+'</div>':'')+(de?'<div class="kscrape-description">'+h(de)+'</div>':'')+'</div>';await rq(tx(db,'readwrite').put(html,asin));a++;}const all=await rq(tx(db,'readonly').getAll());const t=all.length;if(confirm('Page: +'+a+'. Total: '+t+'\n\nOK=copy+reset. Cancel=keep paginating.')){const ht='<html><body>'+all.join('\n')+'</body></html>';await navigator.clipboard.writeText(ht);await rq(tx(db,'readwrite').clear());alert('Copied '+t+' enrichment records.');}})();
*/

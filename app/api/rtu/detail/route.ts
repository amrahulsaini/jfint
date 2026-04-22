import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { cacheGetJson, cacheSetJson, stableCacheHash } from '@/lib/cache';

const RTU_URL =
  'https://rtu.sumsraj.com/Monitoring/Examination/ACD_Track_PaperMarksEntry_RTU.aspx';
const RTU_DETAIL_CACHE_TTL_SECONDS = 20;

const BROWSER_HEADERS = (cookie: string) => ({
  Cookie: cookie,
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept: '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: RTU_URL,
  Origin: 'https://rtu.sumsraj.com',
  Connection: 'keep-alive',
});

function parseGridFromHtml(html: string) {
  const $ = cheerio.load(html);
  const table = $('table').first();
  if (!table.length) return { columns: [] as string[], rows: [] as Record<string, string>[] };

  const columns: string[] = [];
  table.find('tr').first().find('th, td').each((_, el) => {
    columns.push($(el).text().trim());
  });

  const rows: Record<string, string>[] = [];
  table.find('tr').each((i, rowEl) => {
    if (i === 0) return;
    const cells: string[] = [];
    $(rowEl).find('td').each((_, td) => {
      cells.push($(td).text().trim());
    });
    if (cells.length && cells.some((c) => c !== '')) {
      const row: Record<string, string> = {};
      cells.forEach((cell, ci) => { row[columns[ci] ?? `col${ci}`] = cell; });
      rows.push(row);
    }
  });

  return { columns, rows };
}

export async function POST(req: NextRequest) {
  let body: Record<string, string>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { cookie, eventTarget, ...formFields } = body;
  if (!cookie)      return NextResponse.json({ error: 'cookie required' }, { status: 400 });
  if (!eventTarget) return NextResponse.json({ error: 'eventTarget required' }, { status: 400 });

  const cacheKey = `rtu:detail:v1:${stableCacheHash({ cookie, eventTarget, formFields })}`;
  const cached = await cacheGetJson<Record<string, unknown>>(cacheKey);
  if (cached) {
    const hit = NextResponse.json(cached);
    hit.headers.set('X-Cache', 'HIT');
    return hit;
  }

  const viewState    = formFields.__VIEWSTATE ?? '';
  const viewStateGen = formFields.__VIEWSTATEGENERATOR ?? '68EA6D12';

  // ─── Anthem callback — same as browser's Anthem-overridden __doPostBack ───
  // In the real RTU page, __doPostBack is hooked by Anthem.js to fire
  // Anthem_FireCallBackEvent, which sends Anthem_CallBack=true.
  // The server processes the RowCommand via Anthem and returns JSON with
  // gvDegreewiseCount containing the student table.
  const params = new URLSearchParams();
  params.set('Anthem_CallBack',      'true');
  params.set('Anthem_UpdatePage',    'true');
  params.set('__EVENTTARGET',        eventTarget);
  params.set('__EVENTARGUMENT',      '');
  params.set('__LASTFOCUS',          '');
  params.set('__VIEWSTATE',          viewState);
  params.set('__VIEWSTATEGENERATOR', viewStateGen);
  params.set('__VIEWSTATEENCRYPTED', '');

  for (const [k, v] of Object.entries(formFields)) {
    if (!['__VIEWSTATE', '__VIEWSTATEGENERATOR', '__EVENTVALIDATION'].includes(k) && v != null) {
      params.set(k, v);
    }
  }

  try {
    const res = await fetch(RTU_URL, {
      method: 'POST',
      headers: {
        ...BROWSER_HEADERS(cookie),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const raw = await res.text();

    // ─── Session check ──────────────────────────────────────────────────
    if (raw.includes('txtUserName') && raw.includes('txtPassword')) {
      return NextResponse.json({ error: 'SESSION_EXPIRED' }, { status: 401 });
    }

    let title       = '';
    let studentGrid = { columns: [] as string[], rows: [] as Record<string, string>[] };
    let addMoreGrid = { columns: [] as string[], rows: [] as Record<string, string>[] };

    // ── Try Anthem JSON (expected when Anthem_CallBack=true) ─────────────
    const trimmed = raw.trimStart();
    if (trimmed.startsWith('{')) {
      try {
        const json = JSON.parse(raw) as {
          viewState?: string;
          controls?: Record<string, string>;
          error?: string;
        };
        const controls = json.controls ?? {};

        // Faculty / Paper title
        for (const [k, v] of Object.entries(controls)) {
          if (k.includes('lblFacyltyName') && v) {
            const $t = cheerio.load(v);
            title = $t.text().trim();
          }
        }

        // Student grid (gvDegreewiseCount)
        for (const [k, v] of Object.entries(controls)) {
          if (k.includes('gvDegreewiseCount') && (v?.length ?? 0) > 50) {
            studentGrid = parseGridFromHtml(v);
          }
        }

        // Additional grid (gridmenualentry)
        for (const [k, v] of Object.entries(controls)) {
          if (k.includes('gridmenualentry') && (v?.length ?? 0) > 50) {
            addMoreGrid = parseGridFromHtml(v);
          }
        }
      } catch (e) {
        console.error('[detail] JSON parse failed:', e);
      }
    }

    // ── Fallback: parse full HTML response ────────────────────────────────
    if (studentGrid.rows.length === 0 && !trimmed.startsWith('{')) {
      const $ = cheerio.load(raw);

      title = $(`#ctl00_ContentPlaceHolder1_lblFacyltyName`).text().trim()
        || $(`[id*="lblFacyltyName"]`).text().trim();

      let studentHtml = '';
      const selectors = [
        'table#ctl00_ContentPlaceHolder1_gvDegreewiseCount',
        '[id$="gvDegreewiseCount"] table',
        '[id*="gvDegreewiseCount"] table',
      ];
      for (const sel of selectors) {
        const el = $(sel).first();
        if (el.length) {
          studentHtml = el.prop('outerHTML') ?? '';
          if (studentHtml.length > 50) break;
        }
      }
      if (studentHtml) studentGrid = parseGridFromHtml(studentHtml);

      let addMoreHtml = '';
      const addSelectors = [
        'table#ctl00_ContentPlaceHolder1_gridmenualentry',
        '[id*="gridmenualentry"] table',
      ];
      for (const sel of addSelectors) {
        const el = $(sel).first();
        if (el.length) {
          addMoreHtml = el.prop('outerHTML') ?? '';
          if (addMoreHtml.length > 50) break;
        }
      }
      if (addMoreHtml) addMoreGrid = parseGridFromHtml(addMoreHtml);
    }

    // Return newViewState so the client can chain multiple detail calls
    let newViewState = '';
    if (trimmed.startsWith('{')) {
      try {
        const j2 = JSON.parse(raw) as { viewState?: string };
        if (j2.viewState) newViewState = j2.viewState;
      } catch { /* already parsed above */ }
    }

    const payload = {
      title,
      studentGrid,
      addMoreGrid,
      ...(newViewState ? { newViewState } : {}),
    };

    await cacheSetJson(cacheKey, payload, RTU_DETAIL_CACHE_TTL_SECONDS);
    const miss = NextResponse.json(payload);
    miss.headers.set('X-Cache', 'MISS');
    return miss;

  } catch (err) {
    console.error('[detail error]', err);
    return NextResponse.json({ error: 'Detail fetch failed' }, { status: 500 });
  }
}

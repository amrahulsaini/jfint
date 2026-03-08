import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

const RTU_URL =
  'https://rtu.sumsraj.com/Monitoring/Examination/ACD_Track_PaperMarksEntry_RTU.aspx';

const BROWSER_HEADERS = (cookie: string) => ({
  Cookie: cookie,
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: RTU_URL,
  Origin: 'https://rtu.sumsraj.com',
  Connection: 'keep-alive',
});

function isExpiredHtml(html: string) {
  return !html.includes('D_ddlsession') && !html.includes('ACD_Track_PaperMarksEntry');
}

export async function POST(req: NextRequest) {
  let body: Record<string, string>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { cookie, ...formFields } = body;
  if (!cookie) return NextResponse.json({ error: 'cookie required' }, { status: 400 });

  // ─── Use chained ViewState from last cascade step ──────────────────────
  // The page sends the VS it accumulated through Session→EC→Degree→DC chain.
  // Re-fetching a fresh VS would reset server state and return no data.
  let viewState    = formFields.__VIEWSTATE ?? '';
  let viewStateGen = formFields.__VIEWSTATEGENERATOR ?? '68EA6D12';

  // If no VS supplied (shouldn't happen), fall back to a fresh page fetch
  if (!viewState) {
    try {
      const getRes  = await fetch(RTU_URL, { headers: BROWSER_HEADERS(cookie) });
      const getHtml = await getRes.text();
      if (isExpiredHtml(getHtml)) {
        return NextResponse.json({ error: 'SESSION_EXPIRED' }, { status: 401 });
      }
      const $g     = cheerio.load(getHtml);
      viewState    = $g('#__VIEWSTATE').attr('value') ?? viewState;
      viewStateGen = $g('#__VIEWSTATEGENERATOR').attr('value') ?? viewStateGen;
    } catch { /* fall back to empty */ }
  }

  // ─── POST: Anthem AJAX callback (same as browser's Anthem_FireCallBackEvent on btnSave) ──
  // The browser fires VIEW via Anthem_CallBack=true. This is critical because:
  //   1. Anthem controls only process dropdown values during Anthem callbacks
  //   2. The returned viewState encodes all grid DataKeys (needed for lblformfilled postback)
  //   3. The controls object contains the populated grid HTML
  // Using plain HTML POST would reset ddlPaperType/ddlBatch/ddlCourse to "0".
  const params = new URLSearchParams();
  params.set('Anthem_CallBack',      'true');
  params.set('Anthem_UpdatePage',    'true');
  params.set('__EVENTTARGET',        '');
  params.set('__EVENTARGUMENT',      '');
  params.set('__LASTFOCUS',          '');
  params.set('__VIEWSTATE',          viewState);
  params.set('__VIEWSTATEGENERATOR', viewStateGen);
  params.set('__VIEWSTATEENCRYPTED', '');

  for (const [k, v] of Object.entries(formFields)) {
    if (!['__VIEWSTATE', '__VIEWSTATEGENERATOR'].includes(k) && v != null) {
      params.set(k, v);
    }
  }

  // Click the VIEW button
  params.set('ctl00$ContentPlaceHolder1$btnSave', 'VIEW');

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
    if (isExpiredHtml(raw)) {
      return NextResponse.json({ error: 'SESSION_EXPIRED' }, { status: 401 });
    }

    let gridHtml = '';
    let newVS    = viewState;
    let msg      = '';

    // ── Try Anthem JSON (expected: Anthem_CallBack=true returns JSON) ─────
    const trimmed = raw.trimStart();
    if (trimmed.startsWith('{')) {
      try {
        const json = JSON.parse(raw) as {
          viewState?: string;
          controls?: Record<string, string>;
          error?: string;
        };
        if (json.viewState) newVS = json.viewState;
        const controls = json.controls ?? {};
        for (const [k, v] of Object.entries(controls)) {
          if (k.includes('gvcollegemarksdtl') && (v?.length ?? 0) > 50) {
            gridHtml = v;
          }
          if (k.includes('lblMsg') && (v?.length ?? 0) > 5) {
            const $m = cheerio.load(v); msg = $m.text().trim();
          }
        }
      } catch { /* fall through to HTML parse */ }
    }

    // ── Fallback: parse full HTML response ────────────────────────────────
    if (!gridHtml) {
      const $ = cheerio.load(raw);
      msg = msg
        || $('#ctl00_ContentPlaceHolder1_lblMsg').text().trim()
        || $('#ctl00_ContentPlaceHolder1_lbl_error').text().trim();
      newVS = $('#__VIEWSTATE').attr('value') ?? newVS;

      let table = $('#Anthem_ctl00_ContentPlaceHolder1_gvcollegemarksdtl__').find('table').first();
      if (!table.length) table = $('table#ctl00_ContentPlaceHolder1_gvcollegemarksdtl').first();
      if (!table.length) table = $('[id*="gvcollegemarksdtl"]').find('table').first();
      gridHtml = table.prop('outerHTML') ?? '';
    }

    if (!gridHtml) {
      return NextResponse.json({ rows: [], columns: [], message: msg || 'No data returned.', newViewState: newVS });
    }

    // ── Parse grid HTML into rows ─────────────────────────────────────────
    const $ = cheerio.load(gridHtml);
    const table = $('table').first();
    const columns: string[] = [];
    table.find('tr').first().find('th, td').each((_, el) => {
      columns.push($(el).text().trim());
    });
    const rows: Record<string, string>[] = [];
    table.find('tr').each((i, rowEl) => {
      if (i === 0) return;
      const cells: string[] = [];
      $(rowEl).find('td').each((_, td) => {
        const inp = $(td).find('input[type="text"]');
        cells.push(inp.length ? (inp.attr('value') ?? inp.text().trim()) : $(td).text().trim());
      });
      if (cells.length && cells.some((c) => c !== '')) {
        const row: Record<string, string> = {};
        cells.forEach((cell, ci) => { row[columns[ci] ?? `col${ci}`] = cell; });
        rows.push(row);
      }
    });

    return NextResponse.json({ rows, columns, message: msg, newViewState: newVS });
  } catch (err) {
    console.error('[view error]', err);
    return NextResponse.json({ error: 'Submit failed' }, { status: 500 });
  }
}

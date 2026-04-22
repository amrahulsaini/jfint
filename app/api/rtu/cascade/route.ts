import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { cacheGetJson, cacheSetJson, stableCacheHash } from '@/lib/cache';

const RTU_URL =
  'https://rtu.sumsraj.com/Monitoring/Examination/ACD_Track_PaperMarksEntry_RTU.aspx';
const RTU_CASCADE_CACHE_TTL_SECONDS = 15;

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

function parseSelect($: cheerio.CheerioAPI, id: string) {
  return $(`#${id} option`)
    .toArray()
    .filter((el) => {
      const v = $(el).attr('value');
      return v && v !== '' && v !== '0';
    })
    .map((el) => ({ value: $(el).attr('value')!, label: $(el).text().trim() }));
}

/**
 * Cascade: GET fresh ViewState first, then POST the Anthem.NET callback.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, string>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { cookie, eventTarget, ...formFields } = body;
  if (!cookie)      return NextResponse.json({ error: 'cookie required' }, { status: 400 });
  if (!eventTarget) return NextResponse.json({ error: 'eventTarget required' }, { status: 400 });

  const cacheKey = `rtu:cascade:v1:${stableCacheHash({ cookie, eventTarget, formFields })}`;
  const cached = await cacheGetJson<Record<string, unknown>>(cacheKey);
  if (cached) {
    const hit = NextResponse.json(cached);
    hit.headers.set('X-Cache', 'HIT');
    return hit;
  }

  // ─── Step 1: Get ViewState ────────────────────────────────────────────────
  // Use client-provided ViewState from the previous cascade step (chained).
  // Only fetch fresh from RTU if no ViewState was supplied (i.e., first call).
  let viewState    = formFields.__VIEWSTATE ?? '';
  let viewStateGen = formFields.__VIEWSTATEGENERATOR ?? '68EA6D12';

  if (!viewState) {
    // First call — fetch fresh page to get initial ViewState
    try {
      const getRes  = await fetch(RTU_URL, { headers: BROWSER_HEADERS(cookie) });
      const getHtml = await getRes.text();
      if (isExpiredHtml(getHtml)) {
        return NextResponse.json({ error: 'SESSION_EXPIRED' }, { status: 401 });
      }
      const $g   = cheerio.load(getHtml);
      viewState    = $g('#__VIEWSTATE').attr('value') ?? viewState;
      viewStateGen = $g('#__VIEWSTATEGENERATOR').attr('value') ?? viewStateGen;
    } catch { /* fall back to empty */ }
  }

  // ─── Step 2: POST Anthem callback ─────────────────────────────────────────
  const params = new URLSearchParams();
  params.set('__EVENTTARGET',        eventTarget);
  params.set('__EVENTARGUMENT',      '');
  params.set('__LASTFOCUS',          '');
  params.set('__VIEWSTATE',          viewState);
  params.set('__VIEWSTATEGENERATOR', viewStateGen);
  params.set('__VIEWSTATEENCRYPTED', '');
  params.set('anthem_callbackmanager', 'true');

  for (const [k, v] of Object.entries(formFields)) {
    if (!['__VIEWSTATE', '__VIEWSTATEGENERATOR'].includes(k) && v != null) {
      params.set(k, v);
    }
  }

  try {
    const postRes = await fetch(RTU_URL, {
      method: 'POST',
      headers: {
        ...BROWSER_HEADERS(cookie),
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'X-Anthem-UpdatePage': 'true',
      },
      body: params.toString(),
    });

    const rawText = await postRes.text();

    // Session may have expired mid-chain — detect on the POST response
    if (isExpiredHtml(rawText)) {
      return NextResponse.json({ error: 'SESSION_EXPIRED' }, { status: 401 });
    }

    const options: Record<string, { value: string; label: string }[]> = {
      examConfig: [], degreeCycle: [], subject: [], batch: [], paperName: [],
    };

    const KEY_MAP: Record<string, string> = {
      'd_ddlexamconfiguration': 'examConfig',
      'D_ddlDegreecycle':       'degreeCycle',
      'ddlSubject':             'subject',
      'ddlBatch':               'batch',
      'ddlCourse':              'paperName',
    };

    // ── Try Anthem JSON format first ─────────────────────────────────────
    const trimmed = rawText.trimStart();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const json = JSON.parse(rawText) as {
          error?: string;
          controls?: Record<string, string>;
          [key: string]: unknown;
        };
        const controls = json.controls ?? {};
        for (const [anthemId, innerHtml] of Object.entries(controls)) {
          const $i   = cheerio.load(innerHtml as string);
          const opts = $i('option')
            .toArray()
            .filter((el) => { const v = $i(el).attr('value'); return v && v !== '' && v !== '0'; })
            .map((el) => ({ value: $i(el).attr('value')!, label: $i(el).text().trim() }));
          // Match against known control name suffixes
          for (const [suffix, key] of Object.entries(KEY_MAP)) {
            if (anthemId.includes(suffix)) {
              if (opts.length > 0) options[key] = opts;
              break;
            }
          }
        }
      } catch (e) {
        console.log('[cascade] JSON parse failed:', e);
      }
    }

    // ── Fallback: parse full HTML response ────────────────────────────────
    const $   = cheerio.load(rawText);
    const ps  = (id: string) => parseSelect($, id);
    const HTML_IDS: Record<string, string> = {
      examConfig:  'ctl00_ContentPlaceHolder1_d_ddlexamconfiguration',
      degreeCycle: 'ctl00_ContentPlaceHolder1_D_ddlDegreecycle',
      subject:     'ctl00_ContentPlaceHolder1_ddlSubject',
      batch:       'ctl00_ContentPlaceHolder1_ddlBatch',
      paperName:   'ctl00_ContentPlaceHolder1_ddlCourse',
    };
    for (const [key, htmlId] of Object.entries(HTML_IDS)) {
      const parsed = ps(htmlId);
      if (parsed.length > 0 && options[key].length === 0) {
        options[key] = parsed;
      }
    }

    // Return the new ViewState from the response so the page can chain it
    const $resp  = cheerio.load(rawText);
    const newVS  = $resp('#__VIEWSTATE').attr('value');
    const newVSG = $resp('#__VIEWSTATEGENERATOR').attr('value');
    const payload = {
      options,
      viewState:    newVS  ?? viewState,
      viewStateGen: newVSG ?? viewStateGen,
    };

    await cacheSetJson(cacheKey, payload, RTU_CASCADE_CACHE_TTL_SECONDS);
    const miss = NextResponse.json(payload);
    miss.headers.set('X-Cache', 'MISS');
    return miss;
  } catch (err) {
    console.error('[cascade error]', err);
    return NextResponse.json({ error: 'Cascade failed' }, { status: 500 });
  }
}

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
 * Gets a fresh ViewState + all dropdown options from the live RTU page.
 */
export async function POST(req: NextRequest) {
  let cookie = '';
  try { cookie = (await req.json()).cookie ?? ''; } catch { /* */ }
  if (!cookie) return NextResponse.json({ error: 'cookie required' }, { status: 400 });

  try {
    const res = await fetch(RTU_URL, { headers: BROWSER_HEADERS(cookie) });
    const html = await res.text();

    if (isExpiredHtml(html)) {
      return NextResponse.json({ error: 'SESSION_EXPIRED' }, { status: 401 });
    }

    const $ = cheerio.load(html);

    return NextResponse.json({
      viewState:        $('#__VIEWSTATE').attr('value') ?? '',
      viewStateGen:     $('#__VIEWSTATEGENERATOR').attr('value') ?? '68EA6D12',
      selectedCollege:  $('#ctl00_ContentPlaceHolder1_ddlcollegename option[selected]').attr('value') ?? '140',
      options: {
        college:      parseSelect($, 'ctl00_ContentPlaceHolder1_ddlcollegename'),
        sessions:     parseSelect($, 'ctl00_ContentPlaceHolder1_D_ddlsession'),
        degrees:      parseSelect($, 'ctl00_ContentPlaceHolder1_D_ddlDegree'),
        paperTypes:   parseSelect($, 'ctl00_ContentPlaceHolder1_ddlPaperType'),
        studentCats:  parseSelect($, 'ctl00_ContentPlaceHolder1_D_ddlStucategory'),
        examTypes:    parseSelect($, 'ctl00_ContentPlaceHolder1_ddlexamtype'),
      },
    });
  } catch (err) {
    console.error('[init error]', err);
    return NextResponse.json({ error: 'Network error' }, { status: 500 });
  }
}

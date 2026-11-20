# -*- coding: utf-8 -*-
"""
Генерація пояснювальної записки до STEM-проєкту (python-docx).
Запуск: python docs/build_report.py  (з каталогу STEM)
"""
import os
import re

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK, WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Mm, Pt, RGBColor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.join(ROOT, 'screenshots')
DIAG = os.path.join(SHOTS, 'diagrams')
OUT = os.path.join(ROOT, 'Пояснювальна_записка_STEM_Марчук_ІПЗ-33.docx')
GIT_URL = 'https://github.com/LaBebra/FRONTLAB/tree/main/STEM/app'

FONT = 'Times New Roman'
BLACK = RGBColor(0, 0, 0)

doc = Document()

# ------------------------------------------------------------------ стилі
def set_font(style_or_run, size=12, bold=None, italic=None, name=FONT):
    f = style_or_run.font
    f.name = name
    f.size = Pt(size)
    f.color.rgb = BLACK
    if bold is not None:
        f.bold = bold
    if italic is not None:
        f.italic = italic
    el = style_or_run.element if hasattr(style_or_run, 'element') else style_or_run._element
    rpr = el.get_or_add_rPr()
    rfonts = rpr.find(qn('w:rFonts'))
    if rfonts is None:
        rfonts = OxmlElement('w:rFonts')
        rpr.append(rfonts)
    for attr in ('w:ascii', 'w:hAnsi', 'w:cs', 'w:eastAsia'):
        rfonts.set(qn(attr), name)
    # тематичні шрифти вбудованих стилів мають пріоритет, тому прибираємо їх
    for attr in ('w:asciiTheme', 'w:hAnsiTheme', 'w:cstheme', 'w:eastAsiaTheme'):
        if rfonts.get(qn(attr)) is not None:
            del rfonts.attrib[qn(attr)]


normal = doc.styles['Normal']
set_font(normal, 12)
pf = normal.paragraph_format
pf.line_spacing = 1.5
pf.space_before = Pt(0)
pf.space_after = Pt(0)
pf.first_line_indent = Cm(1.25)
pf.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
pf.widow_control = True

for lvl, size in ((1, 14), (2, 12), (3, 12)):
    st = doc.styles[f'Heading {lvl}']
    set_font(st, size, bold=True, italic=False)
    st.paragraph_format.first_line_indent = Cm(0) if lvl == 1 else Cm(1.25)
    st.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER if lvl == 1 else WD_ALIGN_PARAGRAPH.LEFT
    st.paragraph_format.space_before = Pt(12 if lvl == 1 else 12)
    st.paragraph_format.space_after = Pt(12 if lvl == 1 else 6)
    st.paragraph_format.line_spacing = 1.5
    st.paragraph_format.keep_with_next = True

sec = doc.sections[0]
sec.page_height, sec.page_width = Mm(297), Mm(210)
sec.left_margin, sec.right_margin = Mm(25), Mm(15)
sec.top_margin, sec.bottom_margin = Mm(20), Mm(20)
sec.footer_distance = Mm(10)
sec.different_first_page_header_footer = True  # без номера на титульному аркуші

CONTENT_W = Mm(170)


def add_field(paragraph, instr):
    run = paragraph.add_run()
    b = OxmlElement('w:fldChar'); b.set(qn('w:fldCharType'), 'begin')
    i = OxmlElement('w:instrText'); i.set(qn('xml:space'), 'preserve'); i.text = instr
    s = OxmlElement('w:fldChar'); s.set(qn('w:fldCharType'), 'separate')
    t = OxmlElement('w:t'); t.text = '1'
    e = OxmlElement('w:fldChar'); e.set(qn('w:fldCharType'), 'end')
    for x in (b, i, s, t, e):
        run._r.append(x)
    set_font(run, 12)
    return run


# номер сторінки в правому нижньому куті
fp = sec.footer.paragraphs[0]
fp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
fp.paragraph_format.first_line_indent = Cm(0)
add_field(fp, 'PAGE')

# ------------------------------------------------------------------ допоміжні функції
counters = {'fig': 0, 'tab': 0, 'lst': 0}
sources = {}
source_order = []

SOURCES = {
    'istqb': 'ISTQB Certified Tester Foundation Level Syllabus v4.0 / International Software Testing Qualifications Board. Brussels: ISTQB, 2023. 74 p. URL: https://www.istqb.org (дата звернення: 20.11.2026).',
    'myers': 'Myers G. J., Sandler C., Badgett T. The Art of Software Testing. 3rd ed. Hoboken: John Wiley & Sons, 2011. 240 p.',
    'pyramid': 'Vocke H. The Practical Test Pyramid. martinfowler.com, 2018. URL: https://martinfowler.com/articles/practical-test-pyramid.html (дата звернення: 20.11.2026).',
    'react': 'React: офіційна документація. Meta Open Source, 2026. URL: https://react.dev (дата звернення: 20.11.2026).',
    'ts': 'TypeScript Handbook. Microsoft, 2026. URL: https://www.typescriptlang.org/docs/handbook/ (дата звернення: 20.11.2026).',
    'garrett': 'Garrett J. J. The Elements of User Experience: User-Centered Design for the Web and Beyond. 2nd ed. Berkeley: New Riders, 2011. 192 p.',
    'uml': 'OMG Unified Modeling Language (OMG UML), Version 2.5.1. Object Management Group, 2017. 796 p. URL: https://www.omg.org/spec/UML/2.5.1 (дата звернення: 20.11.2026).',
    'mermaid': 'Mermaid: Diagramming and charting tool. Документація. 2026. URL: https://mermaid.js.org (дата звернення: 20.11.2026).',
    'vite': 'Vite: Next Generation Frontend Tooling. Документація. 2026. URL: https://vite.dev/guide/ (дата звернення: 20.11.2026).',
    'router': 'React Router v6: документація. Remix Software, 2026. URL: https://reactrouter.com/6.30.0 (дата звернення: 20.11.2026).',
    'zustand': 'Zustand: документація. Poimandres, 2026. URL: https://zustand.docs.pmnd.rs (дата звернення: 20.11.2026).',
    'recharts': 'Recharts: A composable charting library built on React components. 2026. URL: https://recharts.org (дата звернення: 20.11.2026).',
    'workers': 'Using Web Workers / MDN Web Docs. Mozilla, 2026. URL: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers (дата звернення: 20.11.2026).',
    'marcotte': 'Marcotte E. Responsive Web Design. 2nd ed. New York: A Book Apart, 2014. 153 p.',
    'browserslist': 'Browserslist: Share target browsers between different front-end tools. 2026. URL: https://github.com/browserslist/browserslist (дата звернення: 20.11.2026).',
    'owasp': 'OWASP Top 10: 2021. The Ten Most Critical Web Application Security Risks. OWASP Foundation, 2021. URL: https://owasp.org/Top10/ (дата звернення: 20.11.2026).',
    'csp': 'Content Security Policy (CSP) / MDN Web Docs. Mozilla, 2026. URL: https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP (дата звернення: 20.11.2026).',
    'csvinj': 'CSV Injection / OWASP Foundation. 2026. URL: https://owasp.org/www-community/attacks/CSV_Injection (дата звернення: 20.11.2026).',
    'wcag': 'Web Content Accessibility Guidelines (WCAG) 2.2: W3C Recommendation. World Wide Web Consortium, 2023. URL: https://www.w3.org/TR/WCAG22/ (дата звернення: 20.11.2026).',
    'nielsen': 'Nielsen J. 10 Usability Heuristics for User Interface Design. Nielsen Norman Group, 1994 (оновлено 2024). URL: https://www.nngroup.com/articles/ten-usability-heuristics/ (дата звернення: 20.11.2026).',
    'vitest': 'Vitest: Next Generation Testing Framework. Документація. 2026. URL: https://vitest.dev (дата звернення: 20.11.2026).',
    'rtl': 'Testing Library: React Testing Library. Документація. 2026. URL: https://testing-library.com/docs/react-testing-library/intro/ (дата звернення: 20.11.2026).',
    'puppeteer': 'Puppeteer: документація. Google Chrome Team, 2026. URL: https://pptr.dev (дата звернення: 20.11.2026).',
}


def cite(*keys):
    nums = []
    for k in keys:
        if k not in sources:
            source_order.append(k)
            sources[k] = len(source_order)
        nums.append(str(sources[k]))
    return '[' + ', '.join(nums) + ']'


def para(text='', bold=False, italic=False, align=None, indent=True, size=12, space_after=0, keep_next=False):
    p = doc.add_paragraph()
    if align is not None:
        p.alignment = align
    if not indent:
        p.paragraph_format.first_line_indent = Cm(0)
    if space_after:
        p.paragraph_format.space_after = Pt(space_after)
    if keep_next:
        p.paragraph_format.keep_with_next = True
    add_rich(p, text, bold=bold, italic=italic, size=size)
    return p


def add_rich(p, text, bold=False, italic=False, size=12):
    """Підтримка **жирного** та `коду` всередині абзацу."""
    for part in re.split(r'(\*\*[^*]+\*\*|`[^`]+`)', text):
        if not part:
            continue
        if part.startswith('**'):
            r = p.add_run(part[2:-2]); set_font(r, size, bold=True, italic=italic)
        elif part.startswith('`'):
            r = p.add_run(part[1:-1]); set_font(r, size - 1, bold=bold, name='Consolas')
        else:
            r = p.add_run(part); set_font(r, size, bold=bold, italic=italic)


def bullets(items):
    for it in items:
        p = doc.add_paragraph()
        p.paragraph_format.first_line_indent = Cm(0)
        p.paragraph_format.left_indent = Cm(1.25)
        p.paragraph_format.first_line_indent = Cm(-0.5)
        add_rich(p, '- ' + it)


def numbered(items):
    for i, it in enumerate(items, 1):
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Cm(1.25)
        p.paragraph_format.first_line_indent = Cm(-0.6)
        add_rich(p, f'{i}) ' + it)


def h1(text, page_break=True):
    h = doc.add_heading(text.upper(), level=1)
    for r in h.runs:
        set_font(r, 14, bold=True, italic=False)
    h.paragraph_format.page_break_before = page_break
    h.paragraph_format.space_before = Pt(0)
    return h


def h2(text):
    h = doc.add_heading(text, level=2)
    for r in h.runs:
        set_font(r, 12, bold=True, italic=False)
    return h


def h3(text):
    h = doc.add_heading(text, level=3)
    for r in h.runs:
        set_font(r, 12, bold=True, italic=True)
    return h


def figure(path, caption, width=None, height=None):
    counters['fig'] += 1
    n = counters['fig']
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.first_line_indent = Cm(0)
    p.paragraph_format.space_before = Pt(6)
    p.paragraph_format.keep_with_next = True
    p.paragraph_format.line_spacing = 1.0
    run = p.add_run()
    if height is not None:
        run.add_picture(path, height=height)
    else:
        run.add_picture(path, width=width or Cm(16))
    c = doc.add_paragraph()
    c.alignment = WD_ALIGN_PARAGRAPH.CENTER
    c.paragraph_format.first_line_indent = Cm(0)
    c.paragraph_format.space_after = Pt(10)
    add_rich(c, f'Рисунок {n} - {caption}')
    return n


def next_fig():
    return counters['fig'] + 1


def next_tab():
    return counters['tab'] + 1


def set_grid(t, widths_cm):
    """Узгоджує w:tblGrid із шириною колонок (Word у фіксованій розкладці бере ширини саме з сітки)."""
    grid = t._tbl.tblGrid
    for gc, w in zip(grid.findall(qn('w:gridCol')), widths_cm):
        gc.set(qn('w:w'), str(int(Cm(w).twips)))
    tblPr = t._tbl.tblPr
    tblW = tblPr.find(qn('w:tblW'))
    if tblW is None:
        tblW = OxmlElement('w:tblW'); tblPr.append(tblW)
    tblW.set(qn('w:type'), 'dxa'); tblW.set(qn('w:w'), str(int(Cm(sum(widths_cm)).twips)))


def shade(cell, color):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear'); shd.set(qn('w:color'), 'auto'); shd.set(qn('w:fill'), color)
    tcPr.append(shd)


def table(caption, header, rows, widths_cm, size=11):
    counters['tab'] += 1
    n = counters['tab']
    c = doc.add_paragraph()
    c.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    c.paragraph_format.first_line_indent = Cm(0)
    c.paragraph_format.space_before = Pt(6)
    c.paragraph_format.keep_with_next = True
    add_rich(c, f'Таблиця {n} - {caption}')
    t = doc.add_table(rows=1, cols=len(header))
    t.style = 'Table Grid'
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False
    set_grid(t, widths_cm)
    for i, (cell, text) in enumerate(zip(t.rows[0].cells, header)):
        cell.width = Cm(widths_cm[i])
        shade(cell, 'E7E6E6')
        p = cell.paragraphs[0]
        p.paragraph_format.first_line_indent = Cm(0)
        p.paragraph_format.line_spacing = 1.0
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        add_rich(p, text, bold=True, size=size)
    # повторення шапки на кожній сторінці
    trPr = t.rows[0]._tr.get_or_add_trPr()
    th = OxmlElement('w:tblHeader'); th.set(qn('w:val'), 'true'); trPr.append(th)
    for row in rows:
        cells = t.add_row().cells
        for i, (cell, text) in enumerate(zip(cells, row)):
            cell.width = Cm(widths_cm[i])
            p = cell.paragraphs[0]
            p.paragraph_format.first_line_indent = Cm(0)
            p.paragraph_format.line_spacing = 1.0
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            add_rich(p, str(text), size=size)
    sp = doc.add_paragraph()
    sp.paragraph_format.first_line_indent = Cm(0)
    sp.paragraph_format.line_spacing = 1.0
    return n


def listing(caption, code):
    counters['lst'] += 1
    n = counters['lst']
    c = doc.add_paragraph()
    c.paragraph_format.first_line_indent = Cm(0)
    c.paragraph_format.keep_with_next = True
    c.paragraph_format.space_before = Pt(6)
    add_rich(c, f'Лістинг {n} - {caption}')
    t = doc.add_table(rows=1, cols=1)
    t.style = 'Table Grid'
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False
    set_grid(t, [16.5])
    cell = t.rows[0].cells[0]
    cell.width = Cm(16.5)
    shade(cell, 'F4F4F2')
    first = True
    for line in code.strip('\n').split('\n'):
        p = cell.paragraphs[0] if first else cell.add_paragraph()
        first = False
        p.paragraph_format.first_line_indent = Cm(0)
        p.paragraph_format.line_spacing = 1.0
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        r = p.add_run(line if line else ' ')
        set_font(r, 9.5, name='Consolas')
    sp = doc.add_paragraph()
    sp.paragraph_format.line_spacing = 1.0
    return n


def img(name):
    for d in (DIAG, SHOTS):
        p = os.path.join(d, name)
        if os.path.exists(p):
            return p
    raise FileNotFoundError(name)


# ------------------------------------------------------------------ оцінка пагінації та зміст
# Word тут недоступний для автоматизації, тому номери сторінок для змісту
# оцінюються за метриками шрифтів; у Word зміст можна уточнити клавішею F9.
from PIL import ImageFont
from docx.enum.style import WD_STYLE_TYPE
from docx.enum.text import WD_TAB_ALIGNMENT, WD_TAB_LEADER
from docx.table import Table
from docx.text.paragraph import Paragraph

_FONTS = {}
EMU_PT = 12700
PAGE_H = (297 - 40) * 72 / 25.4
TEXT_W = 170 * 72 / 25.4


def _font(name, size, bold):
    mono = name == 'Consolas'
    key = (mono, bool(bold))
    if key not in _FONTS:
        file = {(True, False): 'consola.ttf', (True, True): 'consolab.ttf',
                (False, False): 'times.ttf', (False, True): 'timesbd.ttf'}[key]
        _FONTS[key] = ImageFont.truetype(os.path.join('C:/Windows/Fonts', file), 100)
    return _FONTS[key]


def _runs(p):
    return [(r.text, r.font.name or FONT, r.font.size.pt if r.font.size else 12, bool(r.font.bold)) for r in p.runs]


def _count_lines(p, width_pt, first_indent_pt=0.0):
    words = []
    for text, name, size, bold in _runs(p):
        f = _font(name, size, bold)
        for chunk in re.split(r'(\s+)', text.replace('\t', '    ')):
            if chunk:
                words.append((chunk, f.getlength(chunk) * size / 100))
    if not words:
        return 1
    lines, cur, avail = 1, 0.0, width_pt - first_indent_pt
    for w, wl in words:
        if w.isspace():
            cur += wl
            continue
        if cur + wl > avail and cur > 0:
            lines += 1
            cur, avail = wl, width_pt
        else:
            cur += wl
    return lines


def _lh(size, spacing):
    return 1.107 * size * spacing


def _pt(v):
    return v.pt if v is not None else 0


def _para_block(p):
    pf, spf = p.paragraph_format, p.style.paragraph_format
    spacing = pf.line_spacing or spf.line_spacing or 1.0
    if not isinstance(spacing, float):
        spacing = 1.0
    size = max([r[2] for r in _runs(p)] or [12])
    first = pf.first_line_indent if pf.first_line_indent is not None else spf.first_line_indent
    left = pf.left_indent if pf.left_indent is not None else spf.left_indent
    before = pf.space_before if pf.space_before is not None else spf.space_before
    after = pf.space_after if pf.space_after is not None else spf.space_after
    pics = p._p.xpath('.//wp:extent')
    if pics:
        lines = [sum(int(e.get('cy')) for e in pics) / EMU_PT + 4]
    else:
        lines = [_lh(size, spacing)] * _count_lines(p, TEXT_W - _pt(left), _pt(first))
    return {'lines': lines, 'before': _pt(before), 'after': _pt(after),
            'pb': bool(pf.page_break_before), 'brk': bool(p._p.xpath('.//w:br[@w:type="page"]')),
            'keep': bool(pf.keep_with_next or spf.keep_with_next),
            'heading': p.style.name if p.style.name in ('Heading 1', 'Heading 2') else None, 'p': p}


def _table_block(t):
    rows = []
    for row in t.rows:
        hmax = 0
        for cell in row.cells:
            w = (cell.width.pt if cell.width else TEXT_W / len(row.cells)) - 11
            h = 0
            for cp in cell.paragraphs:
                size = max([r[2] for r in _runs(cp)] or [11])
                h += _count_lines(cp, w) * _lh(size, cp.paragraph_format.line_spacing or 1.0)
            hmax = max(hmax, h)
        rows.append(hmax + 1.5)
    return {'lines': rows, 'before': 0, 'after': 0, 'pb': False, 'brk': False, 'keep': False, 'heading': None, 'p': None}


def _paginate(blocks):
    page, used, pages = 1, 0.0, {}
    for i, b in enumerate(blocks):
        if b['pb'] and used > 0:
            page, used = page + 1, 0.0
        before = b['before'] if used > 0 else 0
        if b['keep'] and i + 1 < len(blocks):
            nxt = blocks[i + 1]
            need = before + sum(b['lines']) + b['after'] + nxt['before'] + sum(nxt['lines'][:2])
            if used + need > PAGE_H and used > 0:
                page, used, before = page + 1, 0.0, 0
        if b['heading']:
            pages[id(b['p']._p)] = page
        used += before
        for lh in b['lines']:
            if used + lh > PAGE_H and used > 0:
                page, used = page + 1, 0.0
            used += lh
        used += b['after']
        if b['brk']:
            page, used = page + 1, 0.0
    return pages, page


def _fld(kind=None, instr=None):
    r = OxmlElement('w:r')
    if instr is not None:
        t = OxmlElement('w:instrText'); t.set(qn('xml:space'), 'preserve'); t.text = instr
        r.append(t)
    else:
        c = OxmlElement('w:fldChar'); c.set(qn('w:fldCharType'), kind)
        r.append(c)
    return r


def build_toc():
    for name, left in (('TOC 1', 0), ('TOC 2', 0.6)):
        try:
            st = doc.styles[name]
        except KeyError:
            st = doc.styles.add_style(name, WD_STYLE_TYPE.PARAGRAPH)
        st.base_style = doc.styles['Normal']
        set_font(st, 12)
        st.paragraph_format.first_line_indent = Cm(0)
        st.paragraph_format.left_indent = Cm(left)
        st.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
        st.paragraph_format.tab_stops.add_tab_stop(Mm(170), WD_TAB_ALIGNMENT.RIGHT, WD_TAB_LEADER.DOTS)

    heads = [p for p in doc.paragraphs if p.style.name in ('Heading 1', 'Heading 2')]
    # 1) вставляємо рядки змісту з тимчасовими номерами, щоб врахувати їх обсяг
    entries = []
    prev = toc_anchor._p
    for idx, h in enumerate(heads):
        newp = OxmlElement('w:p')
        prev.addnext(newp)
        prev = newp
        par = Paragraph(newp, toc_anchor._parent)
        par.style = doc.styles['TOC 1' if h.style.name == 'Heading 1' else 'TOC 2']
        par.paragraph_format.tab_stops.add_tab_stop(Mm(170), WD_TAB_ALIGNMENT.RIGHT, WD_TAB_LEADER.DOTS)
        if idx == 0:
            newp.append(_fld('begin')); newp.append(_fld(instr='TOC \\o "1-2" \\h \\z \\u')); newp.append(_fld('separate'))
        run = par.add_run(f'{h.text}\t0')
        set_font(run, 12)
        if idx == len(heads) - 1:
            newp.append(_fld('end'))
        entries.append((h, run))
    toc_anchor._p.getparent().remove(toc_anchor._p)
    # 2) оцінюємо пагінацію і записуємо номери
    blocks = []
    for el in doc.element.body.iterchildren():
        tag = el.tag.split('}')[1]
        if tag == 'p':
            blocks.append(_para_block(Paragraph(el, doc)))
        elif tag == 'tbl':
            blocks.append(_table_block(Table(el, doc)))
    pages, total = _paginate(blocks)
    for h, run in entries:
        run.text = f'{h.text}\t{pages[id(h._p)]}'
    print('estimated pages:', total)


# ================================================================== ТИТУЛЬНИЙ АРКУШ
def tp(text, bold=False, size=14, space_after=0, align=WD_ALIGN_PARAGRAPH.CENTER):
    p = doc.add_paragraph()
    p.alignment = align
    p.paragraph_format.first_line_indent = Cm(0)
    p.paragraph_format.line_spacing = 1.15
    p.paragraph_format.space_after = Pt(space_after)
    r = p.add_run(text)
    set_font(r, size, bold=bold)
    return p


tp('КИЇВСЬКИЙ НАЦІОНАЛЬНИЙ УНІВЕРСИТЕТ імені Тараса Шевченка', bold=True)
tp('ФАКУЛЬТЕТ ІНФОРМАЦІЙНИХ ТЕХНОЛОГІЙ', bold=True)
tp('Кафедра програмних систем і технологій')
for _ in range(5):
    tp('')
tp('Дисципліна')
tp('«Розробник фронтенду програмних систем»', bold=True, space_after=24)
tp('ІНДИВІДУАЛЬНИЙ STEM-ПРОЄКТ', bold=True, size=16)
tp('Пояснювальна записка до технічної документації', space_after=18)
tp('Тема проєкту:')
tp('«Веб-застосунок для автоматизації тестування програмного забезпечення (Фронтенд складова)»', bold=True)
for _ in range(6):
    tp('')

tt = doc.add_table(rows=2, cols=4)
tt.alignment = WD_TABLE_ALIGNMENT.CENTER
tt.autofit = False
set_grid(tt, [4.2, 4.3, 3.8, 4.3])
cells_text = [
    ['Виконав / здобувач:', 'Михайло МАРЧУК', 'Перевірила:', 'Ірина ЮРЧУК'],
    ['Група (підгрупа)', 'ІПЗ-33', 'Дата перевірки', '__________'],
]
for r, row in enumerate(cells_text):
    for c, text in enumerate(row):
        cell = tt.rows[r].cells[c]
        cell.width = Cm([4.2, 4.3, 3.8, 4.3][c])
        p = cell.paragraphs[0]
        p.paragraph_format.first_line_indent = Cm(0)
        p.paragraph_format.line_spacing = 1.3
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        run = p.add_run(text)
        set_font(run, 13, bold=(c in (1, 3) and r == 0))

for _ in range(6):
    tp('')
tp('Київ - 2026')

# ================================================================== ЗМІСТ
doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)
toc_h = doc.add_paragraph()
toc_h.alignment = WD_ALIGN_PARAGRAPH.CENTER
toc_h.paragraph_format.first_line_indent = Cm(0)
toc_h.paragraph_format.space_after = Pt(12)
r = toc_h.add_run('ЗМІСТ'); set_font(r, 14, bold=True)
toc_anchor = doc.add_paragraph()  # сюди буде вставлено поле змісту з обчисленими номерами сторінок

# ================================================================== ВСТУП
h1('Вступ')
para('Автоматизоване тестування є невідʼємною складовою сучасного процесу розробки програмного забезпечення: воно дозволяє швидко виявляти регресії, скорочує вартість виправлення дефектів і робить якість продукту вимірюваною ' + cite('istqb', 'myers') + '. Водночас командам потрібен зручний інструмент, у якому тест-кейси зберігаються структуровано, запускаються одним натисканням, а результати прогонів відображаються наочно і доступні для аналізу та звітування ' + cite('pyramid') + '.')
para('Темою індивідуального STEM-проєкту є «Веб-застосунок для автоматизації тестування програмного забезпечення (Фронтенд складова)». Результатом роботи є односторінковий веб-застосунок **AutoQA Lab**, реалізований на бібліотеці React ' + cite('react') + ' з мовою TypeScript ' + cite('ts') + '. Застосунок дозволяє керувати тестовими наборами і тест-кейсами, реально виконувати JavaScript-тести у браузері в ізольованому середовищі, переглядати журнал прогонів із фільтрами, аналізувати динаміку якості на дашборді з графіками та експортувати звіти.')
para('**Мета проєкту** - засвоїти сучасну бібліотеку розробки фронтенду та спроєктувати і реалізувати фронтенд програмної системи автоматизації тестування, який відповідає вимогам адаптивності, кросбраузерності, захищеності та забезпечує зручність користувацького досвіду.')
para('Для досягнення мети поставлено такі **завдання**:')
numbered([
    'проаналізувати предметну область автоматизованого тестування та сформулювати функціональні і нефункціональні вимоги до фронтенду;',
    'спроєктувати архітектуру, сценарії взаємодії (діаграми потоку користувача) та поведінку ключових елементів інтерфейсу (діаграми станів);',
    'реалізувати фронтенд на React і TypeScript з урахуванням вимог адаптивності, кросбраузерності, захищеності та UX;',
    'забезпечити якість коду модульними, компонентними та наскрізними (E2E) тестами;',
    'підготувати супровідну технічну документацію: проєктування, опис реалізації, керівництво користувача.',
])
para('**Обʼєкт дослідження** - процес автоматизованого тестування програмного забезпечення. **Предмет дослідження** - методи і засоби побудови клієнтської частини веб-системи для створення, виконання та аналізу автоматизованих тестів.')

# ================================================================== РОЗДІЛ 1
h1('Розділ 1. Проєктування програмного продукту')
h2('1.1 Аналіз предметної області')
para('Типовий процес автоматизованого тестування включає такі етапи: опис тест-кейсів (що перевіряється і з яким очікуваним результатом), групування їх у тестові набори за модулями системи, запуск прогонів, аналіз результатів, повторний запуск після виправлення дефектів і формування звітності ' + cite('istqb') + '. Звідси випливають основні сутності предметної області: користувач, тестовий набір, тест-кейс, прогін і результат виконання тест-кейсу в межах прогону.')
para('Особливістю проєкту є те, що тести не лише симулюються, а реально виконуються у браузері. Кожен тестовий набір містить «код підготовки» - фрагмент системи, що тестується (функції, класи, мок-сервіси), а кожен тест-кейс містить тіло тесту з перевірками у стилі `expect(значення).toBe(очікуване)`. Такий підхід відповідає модульному рівню піраміди тестування ' + cite('pyramid') + ' і дозволяє демонструвати весь цикл роботи QA-інженера без розгортання серверної частини.')
para('Структуру даних фронтенду наведено в таблиці ' + str(next_tab()) + '.')
table('Модель даних фронтенду (TypeScript-інтерфейси)', ['Сутність', 'Основні поля', 'Призначення'], [
    ['User', 'username, name, role (admin / tester / viewer)', 'Автентифікований користувач і його роль'],
    ['Suite', 'id, name, description, setupCode, tags, createdAt, updatedAt', 'Тестовий набір і спільний код системи, що тестується'],
    ['TestCase', 'id, suiteId, title, description, priority, code, timeoutMs, enabled, tags', 'Тест-кейс з тілом тесту на JavaScript'],
    ['Run', 'id, title, scope, status, startedAt, finishedAt, triggeredBy, environment, results[]', 'Прогін (запуск групи тест-кейсів)'],
    ['CaseResult', 'caseId, caseTitle, suiteName, status, durationMs, assertions, error, logs[]', 'Результат одного тест-кейсу в межах прогону'],
    ['Settings', 'theme, defaultTimeoutMs, concurrency, stopOnFirstFailure, historyLimit', 'Налаштування виконання та інтерфейсу'],
], [2.6, 7.4, 6.5])

h2('1.2 Функціональні вимоги')
para('Функціональні вимоги до фронтенду сформульовано з позиції користувача-тестувальника і наведено в таблиці ' + str(next_tab()) + '.')
table('Функціональні вимоги', ['Код', 'Вимога', 'Реалізація'], [
    ['FR-01', 'Вхід за логіном і паролем, вихід, обмеження строку сесії', 'LoginPage, useAuthStore'],
    ['FR-02', 'Розмежування прав за ролями (адміністратор, тестувальник, спостерігач)', 'can(), useCan()'],
    ['FR-03', 'Створення, редагування, видалення тестових наборів; пошук і фільтр за тегом', 'SuitesPage, SuiteFormModal'],
    ['FR-04', 'Створення, редагування, дублювання, вимкнення, видалення тест-кейсів; фільтри за пріоритетом і останнім результатом', 'SuiteDetailPage, CaseFormModal'],
    ['FR-05', 'Пробний запуск тест-кейсу під час редагування', 'CaseFormModal + workerExecutor'],
    ['FR-06', 'Запуск усіх тестів, набору, одного або вибраних тест-кейсів; скасування прогону', 'RunControl, launchRun, cancelRun'],
    ['FR-07', 'Відображення прогресу прогону в реальному часі', 'RunDetailPage, ProgressBar'],
    ['FR-08', 'Журнал прогонів: пошук, фільтри за статусом, набором і датами, сортування, пагінація', 'RunsPage, filterRuns, sortRuns'],
    ['FR-09', 'Деталі прогону: статуси, тривалість, текст помилки, вивід консолі; перезапуск невдалих', 'RunDetailPage'],
    ['FR-10', 'Дашборд: KPI, графіки динаміки та розподілу статусів, рейтинг проблемних і нестабільних тестів, фільтри періоду і набору', 'DashboardPage, stats.ts'],
    ['FR-11', 'Експорт звіту прогону у форматах HTML, CSV, JSON', 'export.ts'],
    ['FR-12', 'Експорт та імпорт робочого простору, скидання до демо-даних, налаштування виконання і теми', 'SettingsPage'],
], [1.6, 9.6, 5.3], size=10.5)

h2('1.3 Нефункціональні вимоги')
para('Відповідно до завдання STEM-проєкту фронтенд має задовольняти вимоги адаптивності, кросбраузерності, захищеності та зручності користувацького досвіду (таблиця ' + str(next_tab()) + ').')
table('Нефункціональні вимоги', ['Група', 'Вимога'], [
    ['Адаптивність', 'Коректне відображення від 320 px до 1920 px без горизонтальної прокрутки; висувне меню на планшетах і телефонах; таблиці перетворюються на картки на вузьких екранах'],
    ['Кросбраузерність', 'Підтримка двох останніх версій Chrome, Edge, Firefox, Firefox ESR, Safari 14+ та iOS 14+; автоматичні вендорні префікси; ціль збірки ES2020'],
    ['Захищеність', 'Ізоляція коду тестів від сторінки; CSP; відсутність відкритих паролів у коді; обмеження спроб входу; RBAC; екранування даних у звітах; перевірка імпортованих файлів'],
    ['UX і доступність', 'Зворотний звʼязок на кожну дію (сповіщення, стани кнопок, прогрес); підтвердження небезпечних дій; навігація клавіатурою; ARIA-атрибути; світла і темна теми; повага до prefers-reduced-motion'],
    ['Продуктивність', 'Розділення коду за сторінками (lazy loading); виконання тестів поза головним потоком; основний пакет до 70 КБ gzip'],
    ['Якість коду', 'Строга типізація TypeScript; покриття модульними тестами понад 80% рядків; наскрізні тести основних сценаріїв'],
], [3.6, 12.9])

h2('1.4 Архітектура фронтенду')
para('Фронтенд побудовано за шаровою архітектурою (рисунок ' + str(next_fig()) + '). Шар представлення складається з React-компонентів сторінок і повторно використовуваних елементів інтерфейсу. Шар стану реалізовано за допомогою сховищ Zustand, які інкапсулюють дані робочого простору, сесію користувача та сповіщення. Шар логіки містить чисті модулі TypeScript без залежності від React, що спрощує їх модульне тестування. Виконання тестів винесено в окремий потік Web Worker.')
figure(img('architecture.png'), 'Архітектура фронтенду AutoQA Lab', width=Cm(16.5))
para('Дані зберігаються у `localStorage` браузера, а сесія - у `sessionStorage`. Звернення до сховища зосереджені в шарі стану, тому на наступному етапі розвитку системи їх можна замінити викликами REST API бекенду без змін у компонентах інтерфейсу.')

h2('1.5 Діаграми потоку користувача')
para('Діаграма потоку користувача (User Flow) показує послідовність кроків, які користувач виконує для досягнення мети ' + cite('garrett') + '. Для AutoQA Lab побудовано дві діаграми: сценарій авторизації та основний сценарій роботи «від створення тест-кейсу до звіту про якість». Діаграми побудовано в нотації блок-схем: овал - початок або кінець сценарію, прямокутник - дія або екран, паралелограм - введення даних, ромб - рішення ' + cite('mermaid') + '.')
figure(img('user_flow_auth.png'), 'Діаграма потоку користувача: авторизація', width=Cm(12.5))
para('**Опис сценарію авторизації (рисунок ' + str(counters['fig']) + ').** Під час відкриття застосунку перевіряється наявність активної сесії. Якщо сесія дійсна, користувач одразу потрапляє на дашборд. Інакше відкривається сторінка входу. Після введення даних спочатку на клієнті перевіряється формат полів (логін 3-32 латинські символи, пароль не коротший за 6 символів), і помилки показуються під відповідними полями. Далі перевіряються облікові дані. У разі помилки користувач бачить повідомлення з кількістю спроб, що залишились, а після пʼятої невдалої спроби вхід блокується на 60 секунд зі зворотним відліком. Після успішного входу створюється сесія строком дії 8 годин.')
figure(img('user_flow_testing.png'), 'Діаграма потоку користувача: від тест-кейсу до звіту (А - зʼєднувач частин)', width=Cm(15))
para('**Опис основного сценарію (рисунок ' + str(counters['fig']) + ').** З дашборду користувач переходить до тестових наборів і обирає наявний або створює новий набір, описуючи в ньому код системи, що тестується. На сторінці набору він додає тест-кейс і виконує пробний запуск прямо у формі редагування, доки тест не працюватиме як очікується. Збережений тест-кейс запускається у складі набору або повного прогону; хід виконання відображається в реальному часі. Якщо є невдалі тести, користувач аналізує текст помилки і вивід консолі: якщо причина в самому тесті, він повертається до редагування, а якщо в коді системи - виправляє його і перезапускає лише невдалі тести. Коли всі тести пройдено, звіт експортується у потрібному форматі, і мета сценарію досягнута.')

h2('1.6 Діаграми станів')
para('Діаграма станів описує різні стани одного елемента інтерфейсу та події, що спричиняють переходи між ними ' + cite('uml') + '. Ключовим інтерактивним елементом AutoQA Lab є **кнопка керування прогоном** (компонент `RunControl`), яка використовується на дашборді, у картках наборів, на сторінці набору та в рядку кожного тест-кейсу. Її діаграму станів наведено на рисунку ' + str(next_fig()) + ', а опис станів - у таблиці ' + str(next_tab()) + '.')
figure(img('state_runcontrol.png'), 'Діаграма станів кнопки керування прогоном (RunControl)', width=Cm(12.5))
table('Стани кнопки керування прогоном', ['Стан', 'Вигляд', 'Поведінка'], [
    ['Disabled', 'Сіра кнопка «Запустити», підказка з причиною', 'Користувач не має права run (роль «Спостерігач») або в наборі немає активних тест-кейсів'],
    ['Idle', 'Синя кнопка «▶ Запустити»', 'Готовність; клік створює прогін (launchRun) і переводить у Running'],
    ['Running', 'Жовта кнопка «■ Зупинити (N/M)», посилання «Деталі прогону»', 'Лічильник оновлюється після кожного тесту; клік викликає cancelRun'],
    ['Cancelling', 'Кнопка «Зупинення...» зі спінером, недоступна', 'Очікування завершення воркерів, повторні кліки неможливі'],
    ['Passed', 'Зелена кнопка «✓ Успішно»', 'Показ результату 4 с, потім Idle; клік - повторний запуск'],
    ['Failed', 'Червона кнопка «✗ Є помилки»', 'Є тести зі статусом failed, error або timeout; 4 с, потім Idle'],
    ['Cancelled', 'Нейтральна кнопка «Скасовано»', 'Прогін зупинено користувачем; 4 с, потім Idle'],
], [2.4, 6.2, 7.9], size=10.5)
para('Стан компонента визначається не локальним прапорцем, а похідно від статусу прогону в глобальному сховищі, тому кнопка правильно відображає прогін, навіть якщо його скасовано з іншої сторінки. Фактичний вигляд станів, отриманий під час автоматичної E2E-перевірки, показано на рисунку ' + str(next_fig()) + '.')
figure(img('states_combo.png'), 'Стани кнопки керування прогоном у реальному інтерфейсі', width=Cm(15))
para('Додатково побудовано діаграму станів результату окремого тест-кейсу в межах прогону (рисунок ' + str(next_fig()) + '). Ці стани відображаються бейджами з іконкою і текстом, тому їх розрізняють і користувачі з порушенням сприйняття кольору.')
figure(img('state_result.png'), 'Діаграма станів результату тест-кейсу', width=Cm(16))
para('Тест-кейс потрапляє в чергу (Queued) під час створення прогону. Вимкнені тест-кейси одразу отримують стан Skipped. Коли звільняється один із паралельних виконавців, тест переходить у стан Running і завершується одним із фінальних станів: Passed (усі перевірки виконано), Failed (порушено перевірку expect), Error (виняток або синтаксична помилка), Timeout (перевищено ліміт часу, воркер примусово зупинено) або Cancelled (прогін скасовано).')

# ================================================================== РОЗДІЛ 2
h1('Розділ 2. Програмна реалізація')
h2('2.1 Технології та інструменти')
para('Для реалізації обрано бібліотеку **React** ' + cite('react') + ': її компонентна модель добре підходить для інтерфейсу з великою кількістю повторюваних елементів (картки, бейджі, рядки результатів), а декларативний рендеринг спрощує відображення стану прогону в реальному часі. Перелік технологій наведено в таблиці ' + str(next_tab()) + '.')
table('Технології та інструменти', ['Технологія', 'Версія', 'Призначення'], [
    ['React, React DOM', '18.3', 'Компонентна побудова інтерфейсу ' + cite('react')],
    ['TypeScript', '5.9', 'Статична типізація, строгий режим ' + cite('ts')],
    ['Vite', '5.4', 'Сервер розробки, збірка, розділення коду ' + cite('vite')],
    ['React Router', '6.30', 'Клієнтська маршрутизація (HashRouter), захищені маршрути ' + cite('router')],
    ['Zustand', '4.5', 'Керування станом, збереження в localStorage (persist) ' + cite('zustand')],
    ['Recharts', '2.15', 'Графіки дашборду на SVG ' + cite('recharts')],
    ['Web Workers API', '-', 'Ізольоване виконання тестів в окремому потоці ' + cite('workers')],
    ['Autoprefixer, Browserslist', '10.4', 'Вендорні префікси CSS для цільових браузерів ' + cite('browserslist')],
    ['Vitest, Testing Library', '2.1 / 16', 'Модульні та компонентні тести, покриття коду ' + cite('vitest', 'rtl')],
    ['Puppeteer-core + Microsoft Edge', '23.11', 'Наскрізні тести і скріншоти в headless-браузері ' + cite('puppeteer')],
    ['Mermaid', '11.4', 'Побудова діаграм документації ' + cite('mermaid')],
    ['Git, GitHub', '-', 'Контроль версій, зберігання коду'],
], [5.2, 2.2, 9.1])

h2('2.2 Структура проєкту')
para('Вихідний код розміщено в каталозі `STEM/app` репозиторію. Структуру проєкту наведено в лістингу ' + str(counters['lst'] + 1) + '. Загальний обсяг коду - близько 4,5 тис. рядків TypeScript/TSX у робочому коді, 0,8 тис. рядків тестів та 1,8 тис. рядків CSS.')
listing('Структура каталогів застосунку', '''
STEM/app/
├── index.html                 точка входу, мета-теги
├── vite.config.ts             збірка, CSP-плагін, налаштування Vitest
├── package.json               залежності, скрипти, browserslist
├── scripts/e2e.mjs            наскрізний сценарій (Puppeteer + Edge)
└── src/
    ├── main.tsx, App.tsx      маршрутизація, захищені маршрути, lazy-завантаження
    ├── types.ts               доменні типи
    ├── lib/                   логіка: expect, executor, runner, runner.worker,
    │                          stats, export, validate, auth, format, seed, id
    ├── store/                 Zustand: useAppStore, useAuthStore,
    │                          useToastStore, runActions
    ├── components/            Layout, Modal, RunControl, StatusBadge,
    │                          CodeEditor, SuiteFormModal, CaseFormModal, ui
    ├── pages/                 Login, Dashboard, Suites, SuiteDetail,
    │                          Runs, RunDetail, Settings, NotFound
    ├── styles/global.css      дизайн-токени, теми, адаптивність
    └── __tests__/             8 файлів модульних і компонентних тестів
''')

h2('2.3 Ключові прийоми реалізації')
h3('Ізольоване виконання тестів')
para('Найважливіше технічне рішення - реальне виконання коду тестів у браузері без ризику для самого застосунку. Кожен тест-кейс запускається в новому екземплярі **Web Worker** ' + cite('workers') + ': окремий потік не має доступу до DOM, cookie і даних сторінки, а головний потік може примусово завершити його методом `terminate()`. Завдяки цьому нескінченний цикл у тесті не «підвішує» інтерфейс, а коректно завершується зі статусом Timeout. Основну частину виконавця наведено в лістингу ' + str(counters['lst'] + 1) + '.')
listing('Виконавець тесту на основі Web Worker (src/lib/runner.ts, скорочено)', '''
export const workerExecutor: Executor = ({ code, setupCode, timeoutMs, signal }) =>
  new Promise<ExecResult>((resolve) => {
    const url = new URL('./runner.worker.ts', import.meta.url);
    const worker = new Worker(url, { type: 'module' });
    const nonce = createId('n');       // одноразовий ключ проти підробки
    const finish = (result: ExecResult) => {
      clearTimeout(timer);
      worker.terminate();                    // потік знищується після кожного тесту
      resolve(result);
    };
    const timer = setTimeout(() => finish({ status: 'timeout' /* ... */ }), timeoutMs);
    signal.addEventListener('abort', () => finish({ status: 'cancelled' /* ... */ }));
    worker.onmessage = (e) => {
      if (e.data?.nonce !== nonce) return;  // ігноруємо чужі повідомлення
      finish(e.data.outcome);
    };
    worker.postMessage({ nonce, code, setupCode });
  });
''')
para('Усередині воркера код тесту компілюється конструктором `AsyncFunction` у суворому режимі, тому підтримується `await`. Глобальні обʼєкти `window`, `document`, `localStorage`, `fetch`, `XMLHttpRequest`, `WebSocket`, `importScripts` та інші затіняються параметрами зі значенням `undefined`, а мережеві API у воркері додатково вимикаються до виконання стороннього коду. Перевірки реалізовано у власній бібліотеці `expect.ts` з 20 матчерами (toBe, toEqual, toContain, toThrow, toBeCloseTo, toHaveProperty, resolves, rejects та інші) і зрозумілими повідомленнями українською мовою.')
h3('Оркестрація прогону')
para('Функція `runQueue` виконує чергу тест-кейсів пулом із N паралельних виконавців (N від 1 до 4 задається в налаштуваннях), підтримує режим «зупинка після першої невдачі» та скасування через `AbortController`. Про кожну зміну стану вона повідомляє через зворотний виклик, який оновлює результат у сховищі Zustand, тому інтерфейс відображає прогрес у реальному часі. Виконавець передається як параметр (інверсія залежностей), що дозволяє в модульних тестах підставити синхронний виконавець без Web Worker.')
h3('Керування станом і маршрутизація')
para('Глобальний стан зберігається у сховищах Zustand ' + cite('zustand') + ' з проміжним шаром `persist`. Під час відновлення стану з `localStorage` прогони, перервані перезавантаженням сторінки, автоматично позначаються як скасовані, а налаштування нормалізуються до допустимих меж. Маршрутизацію побудовано на `HashRouter` ' + cite('router') + ', що дозволяє розміщувати збірку на статичному хостингу (наприклад, GitHub Pages) без налаштування сервера. Сторінки завантажуються ліниво (`React.lazy`), тому важка бібліотека графіків завантажується лише при відкритті дашборду.')
h3('Дашборд і візуалізація даних')
para('Метрики обчислюються чистими функціями модуля `stats.ts`: зведення прогону, тренд успішності, рейтинг проблемних тест-кейсів із виявленням нестабільних (flaky) тестів, фільтрація за періодом і набором. Графіки побудовано на Recharts ' + cite('recharts') + '. Для статусів використано фіксовану статусну палітру (зелений - пройдено, червоний - провалено, помаранчевий - помилка, жовтий - тайм-аут), причому колір завжди доповнюється легендою, підписом або іконкою. Для темної теми кольори підібрано окремо, а за налаштування `prefers-reduced-motion` анімації графіків вимикаються.')

h2('2.4 Адаптивність і кросбраузерність')
para('Верстка побудована за принципами гнучкого дизайну ' + cite('marcotte') + ': CSS Grid і Flexbox, відносні одиниці, медіазапити для контрольних точок (таблиця ' + str(next_tab()) + '). Кольори, відступи й радіуси винесено в CSS-змінні (дизайн-токени), що дозволило реалізувати світлу і темну теми без дублювання стилів.')
table('Контрольні точки адаптивної верстки', ['Ширина', 'Зміни макета'], [
    ['понад 1200 px', 'Бічне меню, 5 KPI-карток в один ряд, двоколонкова сітка графіків'],
    ['до 1200 px', 'KPI-картки у 3 колонки'],
    ['до 1024 px', 'Графіки дашборду в одну колонку'],
    ['до 900 px', 'Бічне меню стає висувною панеллю з кнопкою-гамбургером і затемненням фону, закривається клавішею Esc'],
    ['до 720 px', 'KPI у 2 колонки, таблиці перетворюються на картки з підписами полів, модальні вікна виїжджають знизу, форми в одну колонку'],
    ['до 420 px', 'Фільтри на всю ширину, сегментований перемикач періоду розтягується'],
], [3.2, 13.3])
para('Кросбраузерність забезпечено таким чином: цільові браузери задано в полі `browserslist` ' + cite('browserslist') + ', Autoprefixer додає вендорні префікси (наприклад, `-webkit-backdrop-filter`, `-webkit-line-clamp`), збірка Vite транспілює код до ES2020. Для властивостей з неповною підтримкою передбачено запасні значення: `100vh` перед `100dvh`, `-webkit-text-size-adjust` разом із `text-size-adjust`. Використано лише стандартні API (Web Workers, Web Crypto, Blob, Intl), які підтримуються всіма цільовими браузерами. Автоматична перевірка у Microsoft Edge (Chromium) підтвердила відсутність горизонтальної прокрутки на ширинах 390 px і 768 px (рисунки ' + str(next_fig()) + ' і ' + str(next_fig() + 1) + ').')
figure(img('mobile_combo.png'), 'Мобільна версія (390 px): дашборд, відкрите меню, сторінка набору', width=Cm(16))
figure(img('21_tablet_dashboard.png'), 'Планшетна версія (768 px): дашборд', height=Cm(13))
figure(img('15_dashboard_dark.png'), 'Дашборд у темній темі', width=Cm(16))

h2('2.5 Захищеність')
para('Заходи безпеки фронтенду спроєктовано з урахуванням ризиків OWASP Top 10 ' + cite('owasp') + ' і зведено в таблиці ' + str(next_tab()) + '.')
table('Загрози та заходи захисту', ['Загроза', 'Захід у AutoQA Lab'], [
    ['Виконання шкідливого коду тесту, доступ до даних сторінки', 'Окремий Web Worker на кожен тест, затінення глобальних обʼєктів, вимкнення мережевих API, тайм-аут із terminate(), одноразовий nonce у повідомленнях'],
    ['XSS (впровадження скриптів)', 'React екранує весь вивід, dangerouslySetInnerHTML не використовується; Content Security Policy ' + cite('csp') + ' з script-src \'self\', object-src \'none\', base-uri \'self\''],
    ['XSS у згенерованих звітах', 'Функція escapeHtml для всіх даних у HTML-звіті'],
    ['CSV/формульна інʼєкція', 'Значення, що починаються з = + - @, екрануються апострофом ' + cite('csvinj')],
    ['Підбір пароля', 'Блокування входу на 60 с після 5 невдалих спроб; хеш обчислюється і для неіснуючого логіна (однаковий час відповіді)'],
    ['Розкриття облікових даних', 'У коді зберігаються лише солені SHA-256 хеші (Web Crypto), порівняння за сталий час'],
    ['Порушення контролю доступу', 'RBAC: функція can(role, action) перевіряється в інтерфейсі та в обробниках дій'],
    ['Викрадення сесії', 'Сесія в sessionStorage (окремо для вкладки) зі строком дії 8 год і періодичною перевіркою'],
    ['Пошкоджені або шкідливі файли імпорту', 'Обмеження розміру (2 МБ), сувора перевірка структури і типів, перевірка посилальної цілісності'],
    ['Витік даних через Referer', 'meta referrer = no-referrer; посилання на завантаження з rel=noopener'],
], [5.0, 11.5], size=10.5)
para('Варто зазначити, що автентифікація на клієнті має демонстраційний характер: у повній системі перевірку паролів і прав виконує бекенд, а фронтенд відповідає за коректну роботу з сесією, приховування недоступних дій і безпечне відображення даних.')

h2('2.6 Зручність користувацького досвіду і доступність')
para('Інтерфейс спроєктовано з урахуванням евристик юзабіліті Нільсена ' + cite('nielsen') + ' та рекомендацій WCAG 2.2 ' + cite('wcag') + ':')
bullets([
    '**видимість стану системи** - стани кнопки запуску, індикатор активних прогонів у верхній панелі і лічильник у меню, live-прогрес, сповіщення після кожної дії;',
    '**запобігання помилкам** - валідація форм з поясненнями під полями, підтвердження перед видаленням і очищенням історії, пробний запуск тесту до збереження;',
    '**свобода і контроль** - скасування прогону, закриття діалогів клавішею Esc і кліком поза вікном, перезапуск лише невдалих тестів;',
    '**доступність** - посилання «Перейти до основного вмісту», семантичні елементи (nav, main, table, figure), ролі і стани ARIA (dialog, tablist, progressbar, aria-live, aria-expanded), утримання фокусу в модальних вікнах, видимий фокус, статуси з іконкою і текстом, а не лише кольором;',
    '**естетика і мінімалізм** - єдина система дизайн-токенів, порожні стани з підказками, світла і темна теми, підлаштування під системні налаштування.',
])

h2('2.7 Тестування')
para('Якість коду забезпечено двома рівнями автоматизованих тестів відповідно до піраміди тестування ' + cite('pyramid') + '. Модульні та компонентні тести написано на Vitest ' + cite('vitest') + ' з React Testing Library ' + cite('rtl') + ' у середовищі jsdom (таблиця ' + str(next_tab()) + ').')
table('Модульні та компонентні тести', ['Файл', 'Тестів', 'Що перевіряється'], [
    ['expect.test.ts', '9', 'Глибоке порівняння, форматування значень, усі групи матчерів, not, resolves і rejects'],
    ['executor.test.ts', '9', 'Статуси passed, failed, error; синтаксичні помилки; async/await; перехоплення console; затінення window, document, fetch; strict mode'],
    ['runner.test.ts', '6', 'Пул виконавців, обмеження паралельності, пропуск вимкнених, зупинка після невдачі, скасування, тайм-аут'],
    ['stats.test.ts', '12', 'Зведення, статус прогону, фільтри журналу, сортування, періоди, тренд, рейтинг і flaky-тести'],
    ['security.test.ts', '16', 'SHA-256, вхід, блокування після 5 спроб, RBAC, escapeHtml, CSV-інʼєкції, безпечні імена файлів, валідація форм та імпорту'],
    ['store.test.ts', '8', 'CRUD наборів і тест-кейсів, каскадне видалення, нормалізація налаштувань, ліміт історії, launchRun і cancelRun'],
    ['components.test.tsx', '12', 'StatusBadge, LoginPage, переходи станів RunControl, ConfirmDialog, CodeEditor'],
    ['forms.test.tsx', '4', 'Валідація SuiteFormModal і CaseFormModal, сповіщення, Layout і мобільне меню'],
    ['Разом', '76', 'Покриття: 87,5% інструкцій, 80,3% гілок'],
], [3.8, 1.6, 11.1], size=10.5)
figure(img('console_vitest.png'), 'Результат запуску модульних тестів і звіт покриття коду', width=Cm(14))
para('Наскрізний сценарій `scripts/e2e.mjs` на Puppeteer ' + cite('puppeteer') + ' запускає production-збірку в headless-браузері Microsoft Edge і виконує 37 перевірок: вхід і його валідацію, роботу фільтрів дашборду, створення набору і тест-кейсів, пробний запуск, ізоляцію коду тесту від DOM, зупинку нескінченного циклу за тайм-аутом, переходи станів кнопки запуску, повний прогін з очікуваними статусами, експорт звітів, фільтри журналу, темну тему, адаптивність на телефоні та планшеті, обмеження ролі «Спостерігач», блокування входу та відсутність помилок у консолі. Цей же сценарій знімає всі скріншоти для документації. Результат наведено на рисунку ' + str(next_fig()) + '.')
figure(img('console_e2e.png'), 'Результат наскрізного (E2E) тестування в Microsoft Edge', width=Cm(14))
para('Демонстраційні дані містять навмисні дефекти в «системі під тестом» (помилка межового значення знижки, невідповідність формату телефону вимозі, повільний сервіс і нестабільний сервіс). Це дозволяє показати на захисті, як застосунок виявляє реальні дефекти, тайм-аути та нестабільні тести.')

h2('2.8 Програмний код у Git')
para('Вихідний код проєкту зберігається в репозиторії GitHub разом з іншими роботами з дисципліни:')
p = para(GIT_URL, indent=False, align=WD_ALIGN_PARAGRAPH.CENTER)
para('Для запуску достатньо встановити Node.js 20 або новіший і виконати команди `npm install`, `npm run dev` (режим розробки) або `npm run build` і `npm run preview` (production-збірка). Команди `npm test`, `npm run coverage` і `npm run e2e` запускають автоматизовані тести. Детальні інструкції наведено у файлі README.md каталогу застосунку.')

# ================================================================== РОЗДІЛ 3
h1('Розділ 3. Керівництво користувача')
h2('3.1 Вступ')
para('**Призначення програми.** AutoQA Lab - веб-застосунок для автоматизації тестування програмного забезпечення. Він вирішує проблему розрізненості тестової інформації: тест-кейси, їх запуск, історія результатів і звіти зібрані в одному місці, а тести виконуються одним натисканням прямо в браузері, без встановлення додаткових інструментів. Дашборд показує, як змінюється якість продукту з часом і які тести є проблемними.')
para('**Для кого це керівництво.** Керівництво призначене для QA-інженерів і розробників, які пишуть автоматизовані тести на JavaScript, а також для керівників команд, які переглядають результати тестування (роль «Спостерігач»). Від користувача очікуються базові знання JavaScript.')

h2('3.2 Швидкий старт')
para('**Перший вхід.** Відкрийте адресу застосунку в браузері (для локального запуску - http://localhost:4173 після команди `npm run preview`). Відкриється сторінка входу (рисунок ' + str(next_fig()) + '). Введіть логін і пароль та натисніть «Увійти». Для ознайомлення передбачено демонстраційні облікові записи (таблиця ' + str(next_tab()) + '); їх можна підставити, розгорнувши блок «Демонстраційні облікові записи» і клацнувши потрібний рядок.')
figure(img('01_login.png'), 'Сторінка входу', width=Cm(14))
table('Демонстраційні облікові записи', ['Логін', 'Пароль', 'Роль', 'Можливості'], [
    ['admin', 'Admin#2026', 'Адміністратор', 'Усі дії, включно з імпортом даних і скиданням до демо-даних'],
    ['tester', 'Tester#2026', 'Тестувальник', 'Створення, редагування, видалення і запуск тестів'],
    ['guest', 'Guest#2026', 'Спостерігач', 'Лише перегляд дашборду, наборів і журналу'],
], [2.2, 2.8, 3.2, 8.3])
para('Якщо логін або пароль введено неправильно, під формою зʼявиться повідомлення із кількістю спроб, що залишились. Після пʼяти невдалих спроб вхід блокується на 60 секунд (рисунок ' + str(next_fig()) + '). Сесія діє 8 годин і закривається разом із вкладкою браузера.')
figure(img('22_login_locked.png'), 'Блокування входу після пʼяти невдалих спроб', width=Cm(12))
para('**Що користувач бачить після входу.** Після входу відкривається дашборд (рисунок ' + str(next_fig()) + ') із загальним станом якості: ключові показники, графік динаміки успішності, результати останнього прогону, розподіл статусів за прогонами, рейтинг проблемних тест-кейсів і список останніх прогонів.')
figure(img('03_dashboard.png'), 'Головний екран (дашборд) після входу', width=Cm(16))

h2('3.3 Огляд інтерфейсу')
para('**Головний екран.** Схематичне розташування елементів головного екрана показано на діаграмі каркасів (рисунок ' + str(next_fig()) + '). Номери на схемі відповідають робочим зонам, описаним нижче.')
figure(img('wf-dashboard.png'), 'Каркас головного екрана (дашборд)', width=Cm(16))
numbered([
    '**Бічне меню** - перехід між розділами: «Дашборд», «Тестові набори», «Журнал прогонів», «Налаштування». Активний розділ підсвічено, біля журналу показується кількість прогонів, що виконуються.',
    '**Верхня панель** - індикатор активних прогонів (посилання на журнал) і перемикач світлої та темної теми. На вузьких екранах тут зʼявляється кнопка меню.',
    '**Кнопка «Запустити всі тести»** - запускає всі активні тест-кейси (або тест-кейси вибраного набору) і відкриває сторінку прогону.',
    '**Фільтри** - період аналізу (7 днів, 30 днів, увесь час) і вибір тестового набору. Усі показники і графіки перераховуються миттєво.',
    '**Ключові показники (KPI)** - кількість тест-кейсів, прогонів за період, успішність останнього прогону, середня успішність і середня тривалість.',
    '**Графік динаміки успішності** та **кільцева діаграма** результатів останнього прогону. Наведення курсора показує точні значення.',
    '**Стовпчикова діаграма** кількості тестів за статусами в кожному прогоні.',
    '**Блок користувача** - імʼя, роль і кнопка «Вийти».',
])
para('Нижче на дашборді розташовано рейтинг проблемних тест-кейсів (частка падінь, позначка «flaky» для нестабільних) і таблицю останніх прогонів. Каркас сторінки тестового набору, на якій користувач працює найчастіше, наведено на рисунку ' + str(next_fig()) + '.')
figure(img('wf-suite.png'), 'Каркас сторінки тестового набору', width=Cm(16))
numbered([
    'Назва та опис набору, посилання повернення до списку наборів.',
    'Кнопки «Налаштувати набір» (назва, теги, код підготовки) і «Запустити набір».',
    'Пошук тест-кейсів і фільтри за пріоритетом та останнім результатом.',
    'Кнопка «Тест-кейс» для створення нового тест-кейсу; після вибору тест-кейсів прапорцями тут зʼявляється кнопка «Запустити вибрані».',
    'Таблиця тест-кейсів: назва (клік відкриває редагування), пріоритет, останній результат, перемикач активності.',
    'Дії в рядку: запуск одного тест-кейсу, дублювання, видалення.',
])
para('На телефоні інтерфейс перебудовується (рисунок ' + str(next_fig()) + '): меню ховається за кнопкою «☰» (1), фільтри розташовуються в стовпчик, KPI-картки - у дві колонки (2), а рядки таблиць перетворюються на картки з підписами полів (3). Відкрите меню (4) закривається кліком по затемненому фону, клавішею Esc або після переходу до розділу.')
figure(img('wf-mobile.png'), 'Каркас мобільної версії: основний екран і відкрите меню', width=Cm(12))

h2('3.4 Покрокова інструкція')
h3('Крок 1. Створення і введення даних')
para('**Створення тестового набору.** Перейдіть у розділ «Тестові набори» (рисунок ' + str(next_fig()) + ') і натисніть «Новий набір». У формі (рисунок ' + str(next_fig() + 1) + ') вкажіть назву (обовʼязково, 3-80 символів, унікальна), теги через кому, опис і **код підготовки** - функції системи, що тестується, або допоміжні фікстури. Цей код автоматично виконується перед кожним тест-кейсом набору. Натисніть «Створити набір» - відкриється сторінка нового набору.')
figure(img('04_suites.png'), 'Розділ «Тестові набори»', width=Cm(16))
figure(img('05_suite_form.png'), 'Форма створення тестового набору', width=Cm(16))
para('**Створення тест-кейсу.** На сторінці набору натисніть «Тест-кейс» (або «Додати тест-кейс» у порожньому наборі). Заповніть назву, пріоритет (критичний, високий, середній, низький), тайм-аут у мілісекундах, опис очікуваного результату й теги. У полі «Код тесту» напишіть тіло тесту з перевірками, наприклад:')
listing('Приклад тіла тест-кейсу', '''
expect(add(2, 3)).toBe(5);              // строга рівність
expect(cart.items).toHaveLength(1);      // довжина масиву
expect(() => divide(1, 0)).toThrow('нуль');
const user = await api.getUser(5);       // підтримується await
expect(user).toEqual({ id: 5, name: 'User 5', active: true });
console.log('Перевірку виконано');       // потрапить у журнал консолі
''')
para('Клавіша Tab у редакторі вставляє відступ. Тест має містити хоча б одну перевірку `expect()`, інакше форма покаже підказку.')
h3('Крок 2. Обробка і редагування')
para('**Пробний запуск.** Не закриваючи форму, натисніть «Пробний запуск». Тест виконається в ізольованому середовищі, і під редактором зʼявиться результат: статус, тривалість, кількість перевірок, текст помилки та вивід консолі (рисунок ' + str(next_fig()) + '). Якщо тест містить нескінченний цикл, його буде зупинено після тайм-ауту (рисунок ' + str(next_fig() + 1) + '). Коли результат вас влаштовує, натисніть «Створити тест-кейс» або «Зберегти».')
figure(img('06_case_form_trial.png'), 'Форма тест-кейсу з результатом пробного запуску', width=Cm(16))
figure(img('07_case_timeout.png'), 'Нескінченний цикл зупинено за тайм-аутом', width=Cm(16))
para('**Редагування та впорядкування.** Щоб змінити тест-кейс, клацніть його назву в таблиці (рисунок ' + str(next_fig()) + '). Перемикач «Активний» тимчасово виключає тест-кейс з прогонів (він отримає статус «Пропущено»). Кнопка дублювання створює копію для подібного сценарію. Фільтри над таблицею допомагають швидко знайти, наприклад, усі критичні тест-кейси, що впали в останньому прогоні.')
figure(img('08_suite_detail.png'), 'Сторінка тестового набору з таблицею тест-кейсів', width=Cm(16))
para('**Запуск тестів.** Натисніть «Запустити набір» на сторінці набору, кнопку «▶» у рядку тест-кейсу, «Запустити вибрані» після вибору прапорцями або «Запустити всі тести» на дашборді. Під час виконання кнопка показує лічильник і дозволяє зупинити прогін. На сторінці прогону відображається прогрес у реальному часі (рисунок ' + str(next_fig()) + ').')
figure(img('09_run_live.png'), 'Прогін у процесі виконання', width=Cm(16))
para('**Аналіз результатів.** Після завершення сторінка прогону показує підсумкові показники і список результатів із вкладками «Усі», «Невдалі», «Пройдені», «Пропущені» (рисунок ' + str(next_fig()) + '). Клацніть рядок невдалого тесту, щоб побачити очікуване й отримане значення та вивід консолі (рисунок ' + str(next_fig() + 1) + '). Кнопка «Перезапустити невдалі» запускає новий прогін лише з тест-кейсів, що впали.')
figure(img('10_run_result.png'), 'Результати завершеного прогону', width=Cm(16))
figure(img('11_run_failed_details.png'), 'Деталі невдалого тест-кейсу', width=Cm(16))
para('**Журнал прогонів.** Розділ «Журнал прогонів» (рисунок ' + str(next_fig()) + ') містить історію всіх запусків. Використовуйте пошук (за назвою прогону, користувачем або тест-кейсом), фільтри за статусом, набором і діапазоном дат, а також сортування за датою, успішністю, тривалістю чи кількістю тестів. Посилання «Скинути фільтри» повертає повний список.')
figure(img('13_runs_filtered.png'), 'Журнал прогонів із застосованим пошуком', width=Cm(16))
para('**Налаштування.** У розділі «Налаштування» (рисунок ' + str(next_fig()) + ') можна змінити тайм-аут за замовчуванням, кількість паралельних виконавців (1-4), увімкнути зупинку прогону після першої невдачі, задати розмір історії та обрати тему оформлення.')
figure(img('14_settings.png'), 'Сторінка налаштувань', width=Cm(16))
h3('Крок 3. Збереження та експорт')
para('Усі зміни (набори, тест-кейси, прогони, налаштування) зберігаються автоматично в браузері і доступні після повторного відкриття застосунку. Для отримання фінального результату передбачено такі способи експорту:')
bullets([
    '**звіт прогону** - на сторінці прогону натисніть «HTML», «CSV» або «JSON». HTML-звіт зручно надіслати колегам або роздрукувати, CSV відкривається в Excel (кирилиця відображається коректно), JSON призначено для інтеграції з іншими системами;',
    '**робочий простір** - у розділі «Налаштування» кнопка «Експортувати JSON» зберігає всі набори, тест-кейси, історію та налаштування в один файл; адміністратор може імпортувати такий файл на іншому компʼютері кнопкою «Імпортувати JSON» (файл попередньо перевіряється на коректність);',
    '**друк** - сторінку прогону можна надрукувати засобами браузера (Ctrl+P): службові елементи інтерфейсу при друці приховуються.',
])
para('Типові ситуації та способи їх вирішення наведено в таблиці ' + str(next_tab()) + '.')
table('Типові проблеми та їх вирішення', ['Ситуація', 'Що робити'], [
    ['Кнопка запуску неактивна', 'У наборі немає активних тест-кейсів або ваша роль «Спостерігач». Увімкніть тест-кейси або увійдіть як тестувальник'],
    ['Тест завершується статусом «Тайм-аут»', 'Збільште тайм-аут тест-кейсу або перевірте код на нескінченні цикли та проміси, що не завершуються'],
    ['Статус «Помилка» з TypeError', 'У тесті виникло виключення, наприклад звернення до неіснуючої властивості. Доступ до window, document і мережі в тестах заборонено'],
    ['Тест падає з повідомленням про відсутність expect()', 'Додайте хоча б одну перевірку expect(...)'],
    ['Вхід заблоковано', 'Зачекайте 60 секунд і повторіть спробу з правильними даними'],
    ['Імпорт не виконується', 'Переконайтеся, що файл є експортом AutoQA Lab (.json, до 2 МБ) і що ви увійшли як адміністратор'],
], [5.5, 11.0])

# ================================================================== ВИСНОВКИ
h1('Висновки')
para('У межах індивідуального STEM-проєкту спроєктовано і реалізовано фронтенд веб-застосунку для автоматизації тестування програмного забезпечення AutoQA Lab. Під час роботи опановано бібліотеку React разом з екосистемою сучасних інструментів: TypeScript, Vite, React Router, Zustand, Recharts, Vitest і Puppeteer.')
para('На етапі проєктування проаналізовано предметну область, сформульовано 12 функціональних і 6 груп нефункціональних вимог, розроблено шарову архітектуру фронтенду, діаграми потоку користувача для сценаріїв авторизації і роботи з тестами, а також діаграми станів кнопки керування прогоном і результату тест-кейсу.')
para('Реалізований застосунок забезпечує повний цикл роботи з автотестами: керування тестовими наборами і тест-кейсами, реальне виконання JavaScript-тестів у браузері в ізольованих Web Worker з тайм-аутами, паралельністю і скасуванням, журнал прогонів із пошуком і фільтрами, аналітичний дашборд із графіками та виявленням нестабільних тестів, експорт звітів у форматах HTML, CSV і JSON.')
para('Вимоги до адаптивності виконано завдяки гнучкій верстці з контрольними точками від 420 до 1200 px, висувному меню і перетворенню таблиць на картки. Кросбраузерність забезпечено налаштуванням browserslist, Autoprefixer і цільовою збіркою ES2020. Захищеність досягнуто ізоляцією коду тестів, політикою CSP, хешуванням паролів, обмеженням спроб входу, рольовою моделлю доступу, екрануванням даних у звітах і суворою перевіркою імпорту. Зручність користувацького досвіду підтримано зворотним звʼязком на кожну дію, підтвердженням небезпечних операцій, доступністю з клавіатури, ARIA-атрибутами і двома темами оформлення.')
para('Якість коду підтверджено 76 модульними і компонентними тестами з покриттям 87,5% інструкцій та 37 наскрізними перевірками в headless-браузері Microsoft Edge, які пройдено без помилок. Подальший розвиток проєкту передбачає підключення серверної частини через REST API, спільну роботу команди над тестами в реальному часі, планування нічних прогонів та інтеграцію з системами CI/CD.')

# ================================================================== ДЖЕРЕЛА
h1('Список використаних джерел')
for i, key in enumerate(source_order, 1):
    p = doc.add_paragraph()
    p.paragraph_format.first_line_indent = Cm(0)
    p.paragraph_format.left_indent = Cm(0.75)
    p.paragraph_format.first_line_indent = Cm(-0.75)
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    add_rich(p, f'{i}. {SOURCES[key]}')

unused = set(SOURCES) - set(source_order)
if unused:
    raise SystemExit(f'Невикористані джерела: {unused}')

# Зміст оновлюється скриптом docs/finalize_word.ps1 (або в Word клавішею F9).

build_toc()
doc.save(OUT)

# контроль: жодного довгого або середнього тире
text = '\n'.join(p.text for p in Document(OUT).paragraphs)
for t in Document(OUT).tables:
    for row in t.rows:
        for c in row.cells:
            text += '\n' + c.text
bad = [ch for ch in (chr(0x2014), chr(0x2013)) if ch in text]
print('saved', OUT)
print('figures', counters['fig'], 'tables', counters['tab'], 'listings', counters['lst'], 'sources', len(source_order))
print('dash check:', 'FAIL' if bad else 'OK')

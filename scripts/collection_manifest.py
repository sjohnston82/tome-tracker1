"""Read the authoritative XLSX and DOCX checklists without contacting a database.

Usage: python scripts/collection_manifest.py --zip collection.zip --output manifest.json
Only the Python standard library is required. Source files are never modified.
"""
import argparse
import collections
import hashlib
import io
import json
import re
import unicodedata
import zipfile
from xml.etree import ElementTree as ET

S = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
R = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
STATUS = {'Read': 'READ', 'Unread': 'UNREAD', 'Currently Reading': 'READING', 'Unknown': 'UNKNOWN'}


def normalize(value):
    return ' '.join(unicodedata.normalize('NFC', value).replace('\u2019', "'").split()).casefold()


def key(kind, *parts):
    return kind + ':' + hashlib.sha256('\0'.join(normalize(p) for p in parts).encode()).hexdigest()


def workbook_rows(data):
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        strings = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            strings = [''.join(si.itertext()) for si in ET.fromstring(archive.read('xl/sharedStrings.xml'))]
        workbook = ET.fromstring(archive.read('xl/workbook.xml'))
        rels = {r.attrib['Id']: r.attrib['Target'] for r in ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))}
        result = {}
        for sheet in workbook.find(S + 'sheets'):
            target = rels[sheet.attrib[R + 'id']]
            path = target.lstrip('/') if target.startswith('/') else 'xl/' + target
            root = ET.fromstring(archive.read(path))
            rows = []
            for row in root.findall('.//' + S + 'sheetData/' + S + 'row'):
                cells = {}
                for cell in row:
                    column = re.match(r'[A-Z]+', cell.attrib['r'])[0]
                    value = cell.findtext(S + 'v', '')
                    if cell.attrib.get('t') == 's':
                        value = strings[int(value)]
                    elif cell.attrib.get('t') == 'inlineStr':
                        value = ''.join(cell.find(S + 'is').itertext())
                    cells[column] = value
                rows.append((int(row.attrib['r']), cells))
            result[sheet.attrib['name']] = rows
        return result


def checklist_tables(data):
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        body = ET.fromstring(archive.read('word/document.xml')).find(W + 'body')
        section = None
        for item in body:
            if item.tag == W + 'p':
                style = item.find(W + 'pPr/' + W + 'pStyle')
                if style is not None and style.attrib.get(W + 'val') == 'Heading2':
                    section = ''.join(item.itertext()).strip()
            elif item.tag == W + 'tbl' and section:
                rows = [[ ''.join(c.itertext()).strip() for c in row.findall(W + 'tc')] for row in item.findall(W + 'tr')]
                if rows and rows[0] == ['#', 'Book', 'Status']:
                    yield section, rows[1:]


def build_manifest(xlsx, docx):
    sheets = workbook_rows(xlsx)
    if 'Collection' not in sheets or list(sheets['Collection'][0][1].values()) != ['Title', 'Author', 'Series', 'Reading Status']:
        raise ValueError('Expected Collection sheet with Title, Author, Series, Reading Status columns')
    books, review, seen = [], [], set()
    for row, cells in sheets['Collection'][1:]:
        title, author, series, status = (cells.get(c, '').strip() for c in 'ABCD')
        if not any((title, author, series, status)):
            continue
        if not title or not author or status not in STATUS:
            raise ValueError(f'Invalid owned-book row {row}: title/author/status required')
        source_key = key('book', title, author)
        if source_key in seen:
            raise ValueError(f'Duplicate title/author identity in owned row {row}; resolve editions explicitly')
        seen.add(source_key)
        books.append({'sourceKey': source_key, 'title': title, 'authorName': author,
                      'seriesName': None if series in ('', '\ufffd', '—', '-') else series,
                      'readingStatus': STATUS[status], 'publicationYear': None,
                      'source': {'file': 'Book_Collection_Master.xlsx', 'sheet': 'Collection', 'row': row}})
        if '\ufffd' in title + author:
            review.append({'code': 'SOURCE_ENCODING', 'sourceKey': source_key, 'message': 'Source text contains a replacement character; preserve and review.'})
    counts = dict(collections.Counter(b['readingStatus'] for b in books))
    summary = {c.get('A'): c.get('B') for _, c in sheets.get('Summary', [])}
    if 'Books owned' in summary and int(summary['Books owned']) != len(books):
        raise ValueError('Owned count does not reconcile to workbook Summary')
    expected_read = summary.get('Books read', '').split('/')[0]
    for label, count in [('Books read', expected_read), ('Currently reading', summary.get('Currently reading')), ('Unread', summary.get('Unread'))]:
        status = {'Books read': 'READ', 'Currently reading': 'READING', 'Unread': 'UNREAD'}[label]
        if count not in (None, '') and int(count) != counts.get(status, 0):
            raise ValueError(f'{label} does not reconcile to workbook Summary')

    series_records = []
    for heading, rows in checklist_tables(docx):
        pieces = re.split(r'\s+(?:\ufffd|—|–)\s+', heading, maxsplit=1)
        if len(pieces) != 2:
            raise ValueError(f'Cannot identify series and author in heading: {heading}')
        name, author = pieces
        entries = []
        for row_number, row in enumerate(rows, 2):
            if len(row) != 3:
                raise ValueError(f'Unexpected checklist row: {row}')
            position, raw_title, declared_owned = row
            match = re.search(r'\s+\((\d{4})\)$', raw_title)
            year = int(match[1]) if match else None
            title = raw_title[:match.start()] if match else re.sub(r'\s*[\[(]forthcoming[\])]$', '', raw_title, flags=re.I)
            work_key = key('work', title, author)
            candidates = [b for b in books if normalize(b['title']) == normalize(title) and normalize(b['authorName']) in [normalize(a.strip()) for a in author.split(' / ')]]
            omnibus = re.search(r'\(in (.+)\)', declared_owned, re.I)
            if omnibus:
                candidates = [b for b in books if normalize(b['title']) == normalize(omnibus[1]) and normalize(b['authorName']) == normalize(author)]
            owned_keys = [b['sourceKey'] for b in candidates] if len(candidates) == 1 else []
            declared = declared_owned.casefold().startswith('owned')
            if len(candidates) > 1 or declared != bool(owned_keys):
                review.append({'code': 'OWNERSHIP_CONFLICT', 'sourceKey': work_key, 'message': f'Checklist says {declared_owned}; Excel matched {len(candidates)} physical books. Ownership remains derived from Excel.', 'seriesName': name, 'title': title, 'candidateKeys': [b['sourceKey'] for b in candidates]})
            if not year:
                review.append({'code': 'UNKNOWN_PUBLICATION', 'sourceKey': work_key, 'message': 'No publication year supplied; forthcoming information is unverified.', 'seriesName': name, 'title': title})
            if '\ufffd' in title:
                review.append({'code': 'SOURCE_ENCODING', 'sourceKey': work_key, 'message': 'Checklist title contains a replacement character.', 'seriesName': name, 'title': title})
            entry_type = 'NOVELLA' if name in ('Bauchelain & Korbal Broach', 'Malazan short fiction') else 'MAIN'
            entries.append({'sourceKey': work_key, 'title': title, 'authorName': author, 'publicationYear': year,
                            'position': float(position) if re.fullmatch(r'\d+(\.\d{1,3})?', position) else None,
                            'entryType': entry_type, 'ownedSourceKeys': owned_keys, 'sourceOwnership': declared_owned,
                            'source': {'file': 'Book_Collection_Series_Checklist.docx', 'heading': heading, 'row': row_number}})
        series_records.append({'name': name, 'sourceKey': key('series', name), 'entries': entries})
    # Years on owned editions come only from exact checklist matches. Conflicting years remain unavailable.
    years = collections.defaultdict(set)
    for series in series_records:
        for entry in series['entries']:
            if entry['publicationYear']:
                for book_key in entry['ownedSourceKeys']:
                    if not entry['sourceOwnership'].casefold().startswith('owned (in '):
                        years[book_key].add(entry['publicationYear'])
    for book in books:
        values = years[book['sourceKey']]
        if len(values) == 1:
            book['publicationYear'] = next(iter(values))
        elif len(values) > 1:
            review.append({'code': 'PUBLICATION_CONFLICT', 'sourceKey': book['sourceKey'], 'message': f'Conflicting original publication years: {sorted(values)}'})
    return {'version': 1, 'dataset': 'tome-collection', 'sourceHashes': {'xlsx': hashlib.sha256(xlsx).hexdigest(), 'docx': hashlib.sha256(docx).hexdigest()},
            'expected': {'owned': len(books), 'statuses': {s: counts.get(s, 0) for s in STATUS.values()}},
            'books': books, 'series': series_records, 'review': review}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--zip', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    with zipfile.ZipFile(args.zip) as archive:
        manifest = build_manifest(archive.read('Book_Collection_Master.xlsx'), archive.read('Book_Collection_Series_Checklist.docx'))
    with open(args.output, 'w', encoding='utf-8') as output:
        json.dump(manifest, output, ensure_ascii=False, indent=2)
    print(json.dumps({'expected': manifest['expected'], 'series': len(manifest['series']), 'entries': sum(len(s['entries']) for s in manifest['series']), 'review': len(manifest['review'])}))


if __name__ == '__main__':
    main()

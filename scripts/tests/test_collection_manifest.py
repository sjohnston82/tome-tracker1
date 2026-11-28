import importlib.util
import io
import sys
import unittest
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

spec = importlib.util.spec_from_file_location('collection_manifest', Path(__file__).parents[1] / 'collection_manifest.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def zipped(files):
    output = io.BytesIO()
    with zipfile.ZipFile(output, 'w') as archive:
        for name, content in files.items():
            archive.writestr(name, content)
    return output.getvalue()


def source_books(rows):
    rows = [('Title', 'Author', 'Series', 'Reading Status')] + rows
    xml_rows = []
    for i, row in enumerate(rows, 1):
        xml_rows.append(f'<row r="{i}">' + ''.join(f'<c r="{column}{i}" t="inlineStr"><is><t>{escape(value)}</t></is></c>' for column, value in zip('ABCD', row)) + '</row>')
    return zipped({
        'xl/workbook.xml': '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Collection" sheetId="1" r:id="rId1"/></sheets></workbook>',
        'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
        'xl/worksheets/sheet1.xml': '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + ''.join(xml_rows) + '</sheetData></worksheet>',
    })


def source_checklist(rows):
    def cell(value):
        return '<w:tc><w:p><w:r><w:t>' + escape(value) + '</w:t></w:r></w:p></w:tc>'
    xml = ''.join('<w:tr>' + ''.join(cell(v) for v in row) + '</w:tr>' for row in [('#', 'Book', 'Status')] + rows)
    return zipped({'word/document.xml': '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>A Series — An Author</w:t></w:r></w:p><w:tbl>' + xml + '</w:tbl></w:body></w:document>'})


class CollectionManifestTests(unittest.TestCase):
    def build(self, books=None, entries=None):
        return module.build_manifest(source_books(books or [('An Omnibus', 'An Author', 'A Series', 'Read')]), source_checklist(entries or [('1', 'A Novel (1990)', 'Not Owned')]))

    def test_counts_and_missing_works(self):
        manifest = self.build()
        self.assertEqual(manifest['expected']['owned'], 1)
        self.assertEqual(manifest['expected']['statuses']['READ'], 1)
        self.assertEqual(manifest['series'][0]['entries'][0]['ownedSourceKeys'], [])

    def test_omnibus_contains_multiple_works_without_multiple_editions(self):
        manifest = self.build(entries=[('1', 'First Novella (1990)', 'Owned (in An Omnibus)'), ('2', 'Second Novella (1991)', 'Owned (in An Omnibus)')])
        self.assertEqual(len(manifest['books']), 1)
        keys = [entry['ownedSourceKeys'] for entry in manifest['series'][0]['entries']]
        self.assertEqual(keys[0], keys[1])
        self.assertIsNone(manifest['books'][0]['publicationYear'])

    def test_reading_statuses_and_stable_keys_after_reordering(self):
        books = [('First', 'An Author', '', 'Read'), ('Second', 'An Author', '', 'Currently Reading'), ('Third', 'An Author', '', 'Unread')]
        one, two = self.build(books), self.build(list(reversed(books)))
        self.assertEqual(one['expected']['statuses'], {'READ': 1, 'READING': 1, 'UNREAD': 1, 'UNKNOWN': 0})
        self.assertEqual(sorted(b['sourceKey'] for b in one['books']), sorted(b['sourceKey'] for b in two['books']))

    def test_duplicate_physical_identity_is_not_silently_dropped(self):
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            self.build([('Same', 'An Author', '', 'Read'), ('Same', 'An Author', '', 'Unread')])

    def test_unknown_status_is_not_silently_changed(self):
        with self.assertRaisesRegex(ValueError, 'Invalid owned-book'):
            self.build([('Book', 'An Author', '', 'Maybe')])

    def test_forthcoming_year_is_not_original_publication(self):
        manifest = self.build(entries=[('1', 'Future Book (forthcoming 2027)', 'Not Owned')])
        self.assertIsNone(manifest['series'][0]['entries'][0]['publicationYear'])
        self.assertEqual(manifest['review'][0]['code'], 'UNKNOWN_PUBLICATION')

    def test_checklist_owned_flag_cannot_create_a_physical_book(self):
        manifest = self.build(entries=[('1', 'A Different Book (1990)', 'Owned')])
        self.assertEqual(len(manifest['books']), 1)
        self.assertEqual(manifest['series'][0]['entries'][0]['ownedSourceKeys'], [])
        self.assertEqual(manifest['review'][0]['code'], 'OWNERSHIP_CONFLICT')


if __name__ == '__main__':
    unittest.main()

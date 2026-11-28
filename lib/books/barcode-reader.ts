import { BarcodeFormat, BinaryBitmap, BitArray, BrowserCodeReader, DecodeHintType, EAN13Reader, MultiFormatOneDReader, NotFoundException, Result, ResultMetadataType } from '@zxing/library';
import { supportsLegacyBookBarcode } from './legacy-barcode';

// The installed ZXing 0.21.x extension decoder appends digits to a local string
// without returning it. Keep its main barcode detection and repair only the
// five-digit supplement, on the SAME decoded scanline, with parity validation.
export class BookOneDReader extends MultiFormatOneDReader {
  private scanningImage = false;
  private incomplete: Result | null = null;

  decode(image: BinaryBitmap, hints?: Map<DecodeHintType, unknown>): Result {
    this.scanningImage = true; this.incomplete = null;
    try { return super.decode(image, hints); }
    catch (cause) {
      if (cause instanceof NotFoundException && this.incomplete) return this.incomplete;
      throw cause;
    } finally { this.scanningImage = false; this.incomplete = null; }
  }

  decodeRow(rowNumber: number, row: BitArray, hints: Map<DecodeHintType, unknown>): Result {
    const result = super.decodeRow(rowNumber, row, hints);
    if (result.getBarcodeFormat() === BarcodeFormat.UPC_A) this.readSupplement(result, row);
    const supplement = result.getResultMetadata()?.get(ResultMetadataType.UPC_EAN_EXTENSION);
    // A shorter add-on can be above the image's center line. Let ZXing try its
    // other scanlines before falling back to a main-UPC-only diagnostic result.
    if (this.scanningImage && supportsLegacyBookBarcode(result.getText()) && !(typeof supplement === 'string' && /^\d{5}$/.test(supplement))) {
      this.incomplete = result;
      throw new NotFoundException();
    }
    return result;
  }

  private readSupplement(result: Result, row: BitArray): void {
    const present = result.getResultMetadata()?.get(ResultMetadataType.UPC_EAN_EXTENSION);
    if (typeof present === 'string' && /^\d{5}$/.test(present)) return;
    try {
      const points = result.getResultPoints();
      const moduleWidth = (points[1].getX() - points[0].getX()) / 92;
      if (moduleWidth <= 0) return;
      const mainEnd = Math.round(points[1].getX() + 1.5 * moduleWidth);
      const guard = EAN13Reader.findGuardPattern(row, mainEnd, false, Int32Array.from([1, 1, 2]), new Int32Array(3));
      if (guard[0] - mainEnd < moduleWidth * 5 || guard[0] - mainEnd > moduleWidth * 30) return;
      let offset = guard[1], parity = 0, text = '';
      const counts = new Int32Array(4);
      for (let index = 0; index < 5; index++) {
        counts.fill(0);
        const digit = EAN13Reader.decodeDigit(row, counts, offset, EAN13Reader.L_AND_G_PATTERNS);
        text += String(digit % 10);
        offset += counts.reduce((sum, value) => sum + value, 0);
        if (digit >= 10) parity |= 1 << (4 - index);
        if (index < 4) { offset = row.getNextSet(offset); offset = row.getNextUnset(offset); }
      }
      const digits = [...text].map(Number);
      const checksum = (3 * (3 * (digits[1] + digits[3]) + digits[0] + digits[2] + digits[4])) % 10;
      const encodings = [0x18, 0x14, 0x12, 0x11, 0x0c, 0x06, 0x03, 0x0a, 0x09, 0x05];
      const quietEnd = offset + Math.max(1, Math.round(moduleWidth * 5));
      if (parity === encodings[checksum] && quietEnd <= row.getSize() && row.isRange(offset, quietEnd, false)) {
        result.putMetadata(ResultMetadataType.UPC_EAN_EXTENSION, text);
      }
    } catch { /* Missing/cropped/damaged supplements must not invalidate the main UPC. */ }
  }
}

export function createBookBarcodeReader(hints: Map<DecodeHintType, unknown>) {
  const reader = new BrowserCodeReader(new BookOneDReader(hints), 250, hints);
  reader.timeBetweenDecodingAttempts = 150;
  return reader;
}

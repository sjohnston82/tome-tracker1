import { describe, expect, it } from 'vitest';
import { BarcodeFormat, BinaryBitmap, BitArray, HybridBinarizer, RGBLuminanceSource, DecodeHintType, ResultMetadataType } from '@zxing/library';
import { BookOneDReader } from '@/lib/books/barcode-reader';
import { legacyBookBarcode } from '@/lib/books/legacy-barcode';

// Independent encoded scanline for UPC 071162007992 + EAN-5 supplement 18784.
// UPC guards/digits are standard L/R encodings; supplement parity is GGLLL.
const main = '10100011010111011001100100110010101111001001101010111001011100101000100111010011101001101100101';
const supplement = '10110110011010001001010111011010110111010100011';
const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.UPC_A]]]);
function decode(extension: string, scale = 1) {
  const bits = '0'.repeat(10) + main + '0'.repeat(9) + extension + '0'.repeat(10);
  const row = new BitArray();
  for (const bit of bits) for (let width = 0; width < scale; width++) row.appendBit(bit === '1');
  return new BookOneDReader(hints).decodeRow(0, row, hints);
}
describe('legacy UPC and five-digit title supplement', () => {
  it.each([1, 2, 3])('decodes the actual barcode bars and resolves the user’s Rand edition at module scale %s', scale => {
    const result = decode(supplement, scale);
    expect(result.getText()).toBe('071162007992');
    const extra = result.getResultMetadata()?.get(ResultMetadataType.UPC_EAN_EXTENSION);
    expect(extra).toBe('18784');
    expect(legacyBookBarcode(result.getText(), extra)).toEqual({ upc: '071162007992', supplement: '18784', isbn13: '9780451187840' });
  });
  it('does not derive an ISBN from the main UPC’s price when the supplement is absent or cropped', () => {
    for (const extra of ['', supplement.slice(0, 20)]) {
      const result = decode(extra);
      expect(result.getText()).toBe('071162007992');
      expect(legacyBookBarcode(result.getText(), result.getResultMetadata()?.get(ResultMetadataType.UPC_EAN_EXTENSION))).toBeNull();
    }
  });
  it('rejects a supplement whose digit parity/checksum disagrees', () => {
    // Replace the first digit’s G pattern by its L pattern, changing parity.
    const result = decode('1011' + '0011001' + supplement.slice(11));
    expect(legacyBookBarcode(result.getText(), result.getResultMetadata()?.get(ResultMetadataType.UPC_EAN_EXTENSION))).toBeNull();
  });
  it('supports UPC-A padding but rejects wrong checksums, unknown publishers and invalid supplements', () => {
    expect(legacyBookBarcode('0071162007992', '18784')?.isbn13).toBe('9780451187840');
    expect(legacyBookBarcode('071162007993', '18784')).toBeNull();
    expect(legacyBookBarcode('012345678905', '18784')).toBeNull();
    for (const extra of [undefined, '', '84', '1878X', 18784]) expect(legacyBookBarcode('071162007992', extra)).toBeNull();
    expect(legacyBookBarcode('9780451187840', '50799')).toBeNull();
  });
  it('preserves distinct title supplements instead of guessing a nearby ISBN', () => {
    expect(legacyBookBarcode('071162007992', '18794')?.isbn13).toBe('9780451187949');
    expect(legacyBookBarcode('071162007992', '18784')?.isbn13).toBe('9780451187840');
  });
  it.each([false, true])('finds the shorter supplement off the center scanline through the real image decoder (upside down: %s)', upsideDown => {
    const full = '0'.repeat(10) + main + '0'.repeat(9) + supplement + '0'.repeat(10);
    const without = '0'.repeat(10) + main + '0'.repeat(9 + supplement.length + 10);
    const width = full.length * 2, height = 80;
    const pixels = new Int32Array(width * height).fill(0xffffff);
    for (let y = 20; y < 60; y++) {
      const bits = y >= 24 && y < 35 ? full : without;
      for (let x = 0; x < width; x++) if (bits[Math.floor(x / 2)] === '1') pixels[y * width + x] = 0;
    }
    if (upsideDown) pixels.reverse();
    const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(pixels, width, height)));
    const result = new BookOneDReader(hints).decode(bitmap, hints);
    expect(result.getText()).toBe('071162007992');
    expect(result.getResultMetadata()?.get(ResultMetadataType.UPC_EAN_EXTENSION)).toBe('18784');
  });
  it('maps the documented Bantam prefix and title supplement to the user’s Clash ISBN', () => {
    // Valid synthetic $7.99 UPC fixture for the documented 076783 publisher prefix.
    expect(legacyBookBarcode('076783007994', '57990')?.isbn13).toBe('9780553579901');
  });

  it('returns a main-UPC diagnostic when no image row contains a supplement and never reuses it for a blank frame', () => {
    const bits = '0'.repeat(10) + main + '0'.repeat(20), width = bits.length * 2, height = 32;
    const pixels = new Int32Array(width * height).fill(0xffffff);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (bits[Math.floor(x / 2)] === '1') pixels[y * width + x] = 0;
    const reader = new BookOneDReader(hints);
    const image = (data: Int32Array) => new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(data, width, height)));
    const result = reader.decode(image(pixels), hints);
    expect(result.getText()).toBe('071162007992');
    expect(legacyBookBarcode(result.getText(), result.getResultMetadata()?.get(ResultMetadataType.UPC_EAN_EXTENSION))).toBeNull();
    expect(() => reader.decode(image(new Int32Array(width * height).fill(0xffffff)), hints)).toThrow();
  });

});

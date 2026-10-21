const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

function isJpegBytes(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 32 || bytes.length > MAX_UPLOAD_BYTES) return false;
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff
    || bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) return false;
  let offset = 2;
  let frame = false;
  let scan = false;
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) return false;
    const marker = bytes[offset + 1];
    if (marker === 0xda) { scan = true; break; }
    if (marker === 0xe1 || marker === 0xed || marker === 0xfe) return false; // EXIF, IPTC, comments
    if (marker === 0xff || marker === 0x00 || (marker >= 0xd0 && marker <= 0xd7)) { offset += 2; continue; }
    const length = bytes.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > bytes.length) return false;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      const height = bytes.readUInt16BE(offset + 5);
      const width = bytes.readUInt16BE(offset + 7);
      if (!width || !height || width > 4096 || height > 4096 || width * height > 16_000_000) return false;
      frame = true;
    }
    offset += 2 + length;
  }
  return frame && scan;
}

module.exports = { MAX_UPLOAD_BYTES, isJpegBytes };

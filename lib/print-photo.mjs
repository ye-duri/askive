// Earlier uploads rely on the helper to draw the QR over image 8.
// New event uploads provide a finished print JPEG in private slot 9.
export function printPhotoKey(id, meta) {
  return id + (meta.printQrEmbedded ? '/9' : '/8');
}

export function printOverlayUrl(id, meta, base) {
  return meta.consent === true && !meta.printQrEmbedded ? new URL('/gallery.html#' + id, base).href : '';
}

// The URL fragment carries all 24 bytes of the original album ID.
export function compactGalleryUrl(id, base) {
  if (!/^[a-f0-9]{48}$/.test(id)) throw new Error('올바른 사진함 주소가 아닙니다.');
  const bytes = id.match(/../g).map(pair => parseInt(pair, 16));
  const token = btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_');
  return new URL('/g#' + token, base).href;
}

export function readAlbumId(token) {
  if (/^[a-f0-9]{48}$/.test(token)) return token;
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) throw new Error('올바른 QR 링크를 열어 주세요.');
  const bytes = atob(token.replaceAll('-', '+').replaceAll('_', '/'));
  return Array.from(bytes, c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
}

const BIHR_IMAGE = /^https?:\/\/(?:api|cdn)\.mybihr\.com\//i;

/**
 * Las fotos del catálogo que siguen apuntando al CDN de Bihr no se abren desde
 * el navegador (403): se piden a través del proxy del backend, igual que en la
 * tienda. El resto de URLs (/uploads, etc.) se dejan tal cual.
 */
export const displayImage = (url: string | null | undefined, width = 400): string =>
  url && BIHR_IMAGE.test(url) ? `/api/image-proxy?w=${width}&url=${encodeURIComponent(url)}` : url || '';

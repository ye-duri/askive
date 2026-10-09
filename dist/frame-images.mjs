// One selected frame owns its original request; no unbounded decoded-image cache.
export async function loadFrameImages(frame, loadImage) {
  let displaySrc = frame.preview || frame.src;
  let image;
  try { image = await loadImage(displaySrc); }
  catch (error) {
    if (displaySrc === frame.src) throw error;
    displaySrc = frame.src;
    image = await loadImage(displaySrc);
  }
  let pending = displaySrc === frame.src ? Promise.resolve(image) : null;
  function original() {
    if (!pending) pending = loadImage(frame.src).catch(error => { pending = null; throw error; });
    return pending;
  }
  return {image, displaySrc, original};
}

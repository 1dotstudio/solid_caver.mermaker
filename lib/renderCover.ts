function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
    img.src = src
  })
}

function rrect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  r: number
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

export async function renderCover(
  canvas: HTMLCanvasElement,
  linocutUrl: string,
  h1Text: string,
  labelText: string
) {
  const W = 1080
  const H = 1920
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  // ── Load fonts ──────────────────────────────────────────────────
  try {
    const beirut = new FontFace('Beirut', 'url(/fonts/Beirut.ttc)')
    const geflow = new FontFace('GEFlow', 'url(/fonts/GE_Flow_Regular.otf)')
    const loaded = await Promise.all([beirut.load(), geflow.load()])
    loaded.forEach(f => document.fonts.add(f))
  } catch (e) {
    console.warn('Custom fonts failed to load, using system fallback:', e)
  }

  // ── 1. Background ─────────────────────────────────────────────
  const bg = await loadImg('/background.png')
  ctx.drawImage(bg, 0, 0, W, H)

  // ── 2. Linocut overlay (multiply blends white→transparent) ────
  const proxied = `/api/proxy-image?url=${encodeURIComponent(linocutUrl)}`
  const linocut = await loadImg(proxied)
  ctx.globalCompositeOperation = 'multiply'
  ctx.drawImage(linocut, 0, 0, W, H)
  ctx.globalCompositeOperation = 'source-over'

  // ── 3. H1 title ───────────────────────────────────────────────
  if (h1Text.trim()) {
    ctx.font = 'bold 158px Beirut, "Arial Unicode MS", Arial'
    ctx.fillStyle = '#2b9dd4'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.shadowColor = 'rgba(9,37,77,0.35)'
    ctx.shadowBlur = 10
    ctx.shadowOffsetY = 5
    ctx.fillText(h1Text.trim(), W / 2, 148)
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0
  }

  // ── 4. Ribbon + label ─────────────────────────────────────────
  if (labelText.trim()) {
    const ry = Math.round(H * 0.662) // ~1271px
    const rh = 136
    const rx = 36
    const rw = W - 72
    const corner = 9

    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.45)'
    ctx.shadowBlur = 18
    ctx.shadowOffsetY = 6
    ctx.fillStyle = '#2b9dd4'
    rrect(ctx, rx, ry, rw, rh, corner)
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0

    // Dashed inner border
    ctx.strokeStyle = 'rgba(255,255,255,0.72)'
    ctx.lineWidth = 2.5
    ctx.setLineDash([11, 7])
    rrect(ctx, rx + 13, ry + 13, rw - 26, rh - 26, corner - 2)
    ctx.stroke()
    ctx.setLineDash([])

    // Label text
    ctx.font = 'italic 66px GEFlow, "Arial Unicode MS", Arial'
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(labelText.trim(), W / 2, ry + rh / 2)
  }
}

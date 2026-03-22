'use client'

import { useState, useRef, useCallback } from 'react'
import { fal } from '@fal-ai/client'
import { renderCover } from '@/lib/renderCover'

fal.config({ proxyUrl: '/api/fal/proxy' })

const LINOCUT_PROMPT = `Transform the provided image into a realistic scanned linoleum print (woodcut), preserving authentic physical print imperfections, with the subject isolated on a clean white background.

CORE INTENT: This must look like a real ink print that was physically carved, printed on paper, and then scanned. NOT a digital illustration. NOT vector art. NOT clean graphic design.

SUBJECT: Extract the person and convert into a chest-up portrait. Preserve accurate facial features and likeness. Maintain natural expression. Remove original background completely.

STYLE: Traditional linocut / woodblock print. Rough hand-carved lines with natural inconsistency. Irregular engraving depth (some lines thicker, some broken). Imperfect carving marks, visible tool strokes.

INK BEHAVIOR (CRITICAL): Ink must behave like real print ink — uneven coverage, patchy areas, slight over-inked regions, slight under-inked gaps, tiny imperfections where ink did not transfer fully. Ink should NOT be flat or uniform. Avoid solid digital fills.

TEXTURE (VERY IMPORTANT): Strong tactile texture INSIDE the subject. Visible grain, noise, micro imperfections. Simulate paper absorption into ink areas. Add subtle noise, print grain, scanned imperfections, slight blur. Must feel like a scanned physical print.

COLOR: Use ONLY one ink color: deep navy blue #09254d. Slight tonal variation inside the ink (not flat).

BACKGROUND: Pure white (#ffffff). Completely clean. No paper texture. No shadows. No gradients.

COMPOSITION (STRICT TEMPLATE): Vertical 9:16 canvas (1080x1920).
ZONE 1: Top 35% empty (pure white).
ZONE 2: Subject placed between 35 percent and 70 percent height. Face centered at 55 percent height. Subject occupies 45-50 percent total height. Chest-up crop only. Include space around head and shoulders.
ZONE 3: Bottom 30% empty (pure white).

SPACING: Equal left/right margins (10 percent). Subject centered horizontally. Subject fully inside central 4:5 safe zone.

LIGHTING: Convert lighting into carved shadow shapes. Use line density instead of gradients.

EDGE TREATMENT: Slightly irregular organic edges. Minor ink fade and breakage along edges. No clean vector cutout. No heavy feathering.

FINAL LOOK: Must feel like a scanned vintage linocut print with real ink imperfections. Slight softness. No vector cleanliness. No digital illustration look. No text. No graphic elements.`

type Status = 'idle' | 'generating' | 'composing' | 'done' | 'error'

const S = {
  page: {
    minHeight: '100vh',
    background: '#080d1a',
    paddingBottom: '60px',
  } as React.CSSProperties,
  header: {
    background: 'linear-gradient(135deg, #09254d 0%, #0d3060 100%)',
    padding: '18px 24px',
    textAlign: 'center' as const,
    borderBottom: '1px solid rgba(43,157,212,0.25)',
  },
  headerTitle: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#e2e8f0',
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
  },
  headerSub: {
    fontSize: '12px',
    color: '#2b9dd4',
    letterSpacing: '0.1em',
    marginTop: '3px',
  },
  wrap: {
    maxWidth: '520px',
    margin: '0 auto',
    padding: '32px 20px',
    direction: 'rtl' as const,
  },
  uploadZone: (hasFile: boolean): React.CSSProperties => ({
    border: `2px dashed ${hasFile ? '#2b9dd4' : '#1e3460'}`,
    borderRadius: '14px',
    padding: '36px 20px',
    textAlign: 'center',
    cursor: 'pointer',
    background: hasFile ? 'rgba(43,157,212,0.07)' : 'rgba(9,37,77,0.25)',
    marginBottom: '22px',
    transition: 'all 0.25s ease',
  }),
  label: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '13px',
    color: '#7fa8c4',
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
  } as React.CSSProperties,
  input: {
    width: '100%',
    padding: '13px 16px',
    background: '#0f1928',
    border: '1.5px solid #1e3460',
    borderRadius: '10px',
    color: '#e2e8f0',
    fontSize: '20px',
    outline: 'none',
    transition: 'border-color 0.2s',
    marginBottom: '18px',
  } as React.CSSProperties,
  btn: (active: boolean): React.CSSProperties => ({
    width: '100%',
    padding: '16px',
    background: active ? 'linear-gradient(135deg, #2b9dd4, #1a7daa)' : '#0f1928',
    color: active ? '#fff' : '#2a4060',
    border: 'none',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: 700,
    cursor: active ? 'pointer' : 'not-allowed',
    letterSpacing: '0.04em',
    transition: 'all 0.2s',
  }),
  error: {
    background: 'rgba(220,38,38,0.12)',
    border: '1px solid rgba(220,38,38,0.35)',
    borderRadius: '10px',
    padding: '12px 16px',
    marginBottom: '18px',
    color: '#fc8181',
    fontSize: '13px',
  } as React.CSSProperties,
  spinner: {
    width: '52px',
    height: '52px',
    border: '4px solid #0f1928',
    borderTop: '4px solid #2b9dd4',
    borderRadius: '50%',
    animation: 'spin 0.9s linear infinite',
    margin: '0 auto 24px',
  } as React.CSSProperties,
  progress: (pct: number): React.CSSProperties => ({
    height: '100%',
    background: 'linear-gradient(90deg, #09254d, #2b9dd4)',
    width: `${pct}%`,
    transition: 'width 0.6s ease',
    borderRadius: '100px',
  }),
}

export default function CoverGenerator() {
  const [photo, setPhoto] = useState<string | null>(null)
  const [photoName, setPhotoName] = useState('')
  const [h1, setH1] = useState('')
  const [label, setLabel] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const onFile = (file: File) => {
    setPhotoName(file.name)
    const r = new FileReader()
    r.onload = e => setPhoto(e.target?.result as string)
    r.readAsDataURL(file)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f?.type.startsWith('image/')) onFile(f)
  }, [])

  const generate = async () => {
    if (!photo) return
    setStatus('generating')
    setProgress(8)
    setErrorMsg('')

    try {
      const result = await fal.subscribe('fal-ai/flux/dev/image-to-image', {
        input: {
          image_url: photo,
          prompt: LINOCUT_PROMPT,
          strength: 0.88,
          num_inference_steps: 28,
          guidance_scale: 3.5,
          image_size: { width: 1080, height: 1920 },
          num_images: 1,
          enable_safety_checker: false,
          seed: Math.floor(Math.random() * 999999),
        },
        onQueueUpdate: () => {
          setProgress(p => Math.min(p + 4, 78))
        },
      })

      setProgress(82)
      setStatus('composing')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const linocutUrl = (result.data as any).images[0].url

      if (canvasRef.current) {
        await renderCover(canvasRef.current, linocutUrl, h1, label)
      }

      setProgress(100)
      setStatus('done')
    } catch (err) {
      console.error(err)
      setErrorMsg(err instanceof Error ? err.message : String(err))
      setStatus('error')
    }
  }

  const download = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const a = document.createElement('a')
    a.download = `solid-insights-cover-${Date.now()}.png`
    a.href = canvas.toDataURL('image/png', 1.0)
    a.click()
  }

  const reset = () => {
    setStatus('idle')
    setPhoto(null)
    setPhotoName('')
    setH1('')
    setLabel('')
    setProgress(0)
    setErrorMsg('')
  }

  const isLoading = status === 'generating' || status === 'composing'

  return (
    <main style={S.page}>
      {/* Header */}
      <header style={S.header}>
        <div style={S.headerTitle}>Cover Generator</div>
        <div style={S.headerSub}>SOLID INSIGHTS</div>
      </header>

      <div style={S.wrap}>

        {/* Canvas always mounted so it's ready for rendering */}
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            borderRadius: '14px',
            display: status === 'done' ? 'block' : 'none',
            marginBottom: '18px',
            boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
            animation: status === 'done' ? 'fadeIn 0.4s ease' : 'none',
          }}
        />

        {/* Done actions */}
        {status === 'done' && (
          <div style={{ display: 'flex', gap: '12px', marginBottom: '28px' }}>
            <button onClick={download} style={{
              flex: 1, padding: '14px',
              background: 'linear-gradient(135deg, #2b9dd4, #1a7daa)',
              color: '#fff', border: 'none', borderRadius: '10px',
              fontSize: '15px', fontWeight: 700, cursor: 'pointer',
            }}>
              ⬇ הורד PNG
            </button>
            <button onClick={reset} style={{
              padding: '14px 18px',
              background: '#0f1928', color: '#7fa8c4',
              border: '1.5px solid #1e3460', borderRadius: '10px',
              fontSize: '15px', cursor: 'pointer',
            }}>
              🔄 חדש
            </button>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div style={{ textAlign: 'center', padding: '48px 20px' }}>
            <div style={S.spinner} />
            <p style={{ color: '#2b9dd4', fontWeight: 700, fontSize: '17px', marginBottom: '6px' }}>
              {status === 'generating' ? '⚙ מייצר ליינוקאט...' : '🎨 מרכיב קאבר...'}
            </p>
            <p style={{ color: '#3a5070', fontSize: '13px', marginBottom: '24px' }}>
              {status === 'generating' ? 'לוקח 30-60 שניות' : 'כמעט מוכן...'}
            </p>
            <div style={{ background: '#0f1928', borderRadius: '100px', height: '5px', overflow: 'hidden' }}>
              <div style={S.progress(progress)} />
            </div>
          </div>
        )}

        {/* Form */}
        {(status === 'idle' || status === 'error') && (
          <>
            {/* Upload zone */}
            <div
              style={S.uploadZone(!!photo)}
              onDrop={onDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }}
              />
              {photo ? (
                <>
                  <div style={{ fontSize: '28px', marginBottom: '8px' }}>✅</div>
                  <p style={{ color: '#2b9dd4', fontWeight: 600, marginBottom: '4px' }}>{photoName}</p>
                  <p style={{ color: '#3a5070', fontSize: '12px' }}>לחץ להחליף</p>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '36px', marginBottom: '10px' }}>📸</div>
                  <p style={{ color: '#7fa8c4', fontWeight: 500, marginBottom: '4px' }}>גרור תמונה או לחץ להעלאה</p>
                  <p style={{ color: '#2a4060', fontSize: '13px' }}>JPG, PNG, WEBP</p>
                </>
              )}
            </div>

            {/* H1 */}
            <label style={S.label} htmlFor="h1-input">כותרת ראשית (H1)</label>
            <input
              id="h1-input"
              type="text"
              value={h1}
              onChange={e => setH1(e.target.value)}
              placeholder="مثال: التخطيط"
              dir="rtl"
              style={S.input}
              onFocus={e => (e.target.style.borderColor = '#2b9dd4')}
              onBlur={e => (e.target.style.borderColor = '#1e3460')}
            />

            {/* Label */}
            <label style={S.label} htmlFor="label-input">טקסט ריבון (Label)</label>
            <input
              id="label-input"
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="مثال: كيف نجحت في اول بزنس؟"
              dir="rtl"
              style={{ ...S.input, fontSize: '17px' }}
              onFocus={e => (e.target.style.borderColor = '#2b9dd4')}
              onBlur={e => (e.target.style.borderColor = '#1e3460')}
            />

            {/* Error */}
            {status === 'error' && (
              <div style={S.error}>❌ {errorMsg || 'שגיאה לא ידועה'}</div>
            )}

            {/* Generate */}
            <button onClick={generate} disabled={!photo} style={S.btn(!!photo)}>
              {status === 'error' ? '🔄 נסה שוב' : '⚡ צור קאבר'}
            </button>
          </>
        )}
      </div>
    </main>
  )
}

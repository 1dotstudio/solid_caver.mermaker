'use client'

import { useState, useRef, useCallback } from 'react'
import { renderCover } from '@/lib/renderCover'

const FAL_MODEL = 'fal-ai/flux/dev/image-to-image'

const LINOCUT_PROMPT = `Transform the provided image into a realistic scanned linoleum print (woodcut), preserving authentic physical print imperfections, with the subject isolated on a clean white background. This must look like a real ink print that was physically carved, printed on paper, and then scanned. NOT a digital illustration. NOT vector art. Extract the person and convert into a chest-up portrait. Preserve accurate facial features and likeness. Remove original background completely. Traditional linocut woodblock print style. Rough hand-carved lines with natural inconsistency. Irregular engraving depth. Imperfect carving marks. Ink must behave like real print ink with uneven coverage, patchy areas, slight over-inked regions, under-inked gaps. Strong tactile texture inside the subject. Visible grain, noise, micro imperfections. Use ONLY one ink color: deep navy blue #09254d. Slight tonal variation inside the ink. Background pure white #ffffff completely clean no shadows no gradients. Vertical 9:16 canvas 1080x1920. Top 35 percent empty pure white. Subject placed between 35 and 70 percent height. Face centered at 55 percent height. Subject occupies 45-50 percent total height. Chest-up crop only. Equal left right margins 10 percent. Subject centered horizontally. Must feel like a scanned vintage linocut print with real ink imperfections. No text. No graphic elements.`

type Status = 'idle' | 'uploading' | 'generating' | 'composing' | 'done' | 'error'

async function generateLinocut(imageUrl: string, onProgress: () => void): Promise<string> {
  const submitRes = await fetch(
    `/api/fal/proxy?url=${encodeURIComponent(`https://queue.fal.run/${FAL_MODEL}`)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: imageUrl,
        prompt: LINOCUT_PROMPT,
        strength: 0.88,
        num_inference_steps: 28,
        guidance_scale: 3.5,
      }),
    }
  )
  if (!submitRes.ok) throw new Error('Submit failed: ' + submitRes.status)
  const submitted = await submitRes.json()
  const statusUrl = submitted.status_url
  if (!statusUrl) throw new Error('No status_url: ' + JSON.stringify(submitted))

  for (let i = 0; i < 120; i++) {
    await new Promise(r => setTimeout(r, 2500))
    onProgress()
    const pollRes = await fetch(`/api/fal/proxy?url=${encodeURIComponent(statusUrl + '?logs=0')}`)
    const poll = await pollRes.json()
    if (poll.status === 'COMPLETED') {
      const responseUrl = poll.response_url || statusUrl.replace('/status', '')
      const resultRes = await fetch(`/api/fal/proxy?url=${encodeURIComponent(responseUrl)}`)
      const result = await resultRes.json()
      const url = result.images?.[0]?.url
      if (url) return url
      throw new Error('No image url in result')
    }
    if (poll.status === 'FAILED') throw new Error('Generation failed')
  }
  throw new Error('Timeout')
}

const S = {
  page: { minHeight: '100vh', background: '#080d1a', paddingBottom: '60px' } as React.CSSProperties,
  header: { background: 'linear-gradient(135deg, #09254d 0%, #0d3060 100%)', padding: '18px 24px', textAlign: 'center' as const, borderBottom: '1px solid rgba(43,157,212,0.25)' },
  headerTitle: { fontSize: '18px', fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.06em', textTransform: 'uppercase' as const },
  headerSub: { fontSize: '12px', color: '#2b9dd4', letterSpacing: '0.1em', marginTop: '3px' },
  wrap: { maxWidth: '520px', margin: '0 auto', padding: '32px 20px', direction: 'rtl' as const },
  uploadZone: (hasFile: boolean): React.CSSProperties => ({
    border: `2px dashed ${hasFile ? '#2b9dd4' : '#1e3460'}`,
    borderRadius: '14px', padding: '36px 20px', textAlign: 'center',
    cursor: 'pointer', background: hasFile ? 'rgba(43,157,212,0.07)' : 'rgba(9,37,77,0.25)',
    marginBottom: '22px', transition: 'all 0.25s ease',
  }),
  labelStyle: { display: 'block', marginBottom: '8px', fontSize: '13px', color: '#7fa8c4', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' as const } as React.CSSProperties,
  input: { width: '100%', padding: '13px 16px', background: '#0f1928', border: '1.5px solid #1e3460', borderRadius: '10px', color: '#e2e8f0', fontSize: '20px', outline: 'none', marginBottom: '18px' } as React.CSSProperties,
  btn: (active: boolean): React.CSSProperties => ({ width: '100%', padding: '16px', background: active ? 'linear-gradient(135deg, #2b9dd4, #1a7daa)' : '#0f1928', color: active ? '#fff' : '#2a4060', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 700, cursor: active ? 'pointer' : 'not-allowed' }),
  error: { background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.35)', borderRadius: '10px', padding: '12px 16px', marginBottom: '18px', color: '#fc8181', fontSize: '13px' } as React.CSSProperties,
  spinner: { width: '52px', height: '52px', border: '4px solid #0f1928', borderTop: '4px solid #2b9dd4', borderRadius: '50%', animation: 'spin 0.9s linear infinite', margin: '0 auto 24px' } as React.CSSProperties,
}

export default function CoverGenerator() {
  const [photo, setPhoto] = useState<string | null>(null)
  const [photoName, setPhotoName] = useState('')
  const [h1, setH1] = useState('')
  const [labelText, setLabelText] = useState('')
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
    setErrorMsg('')
    setProgress(5)

    try {
      // Step 1: upload to fal storage
      setStatus('uploading')
      const blob = await fetch(photo).then(r => r.blob())
      const fd = new FormData()
      fd.append('file', blob, 'photo.jpg')
      const upRes = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!upRes.ok) throw new Error('Upload failed')
      const { url: imageUrl } = await upRes.json()
      setProgress(15)

      // Step 2: generate
      setStatus('generating')
      const linocutUrl = await generateLinocut(imageUrl, () => {
        setProgress(p => Math.min(p + 3, 82))
      })
      setProgress(85)

      // Step 3: compose
      setStatus('composing')
      if (canvasRef.current) {
        await renderCover(canvasRef.current, linocutUrl, h1, labelText)
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
    a.download = `cover-${Date.now()}.png`
    a.href = canvas.toDataURL('image/png', 1.0)
    a.click()
  }

  const reset = () => {
    setStatus('idle'); setPhoto(null); setPhotoName('')
    setH1(''); setLabelText(''); setProgress(0); setErrorMsg('')
  }

  const isLoading = ['uploading', 'generating', 'composing'].includes(status)
  const statusLabel: Record<string, string> = {
    uploading: 'מעלה תמונה...',
    generating: 'מייצר ליינוקאט...',
    composing: 'מרכיב קאבר...',
  }

  return (
    <main style={S.page}>
      <header style={S.header}>
        <div style={S.headerTitle}>Cover Generator</div>
        <div style={S.headerSub}>SOLID INSIGHTS</div>
      </header>

      <div style={S.wrap}>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', borderRadius: '14px', display: status === 'done' ? 'block' : 'none', marginBottom: '18px', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
        />

        {status === 'done' && (
          <div style={{ display: 'flex', gap: '12px', marginBottom: '28px' }}>
            <button onClick={download} style={{ flex: 1, padding: '14px', background: 'linear-gradient(135deg, #2b9dd4, #1a7daa)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 700, cursor: 'pointer' }}>
              הורד PNG
            </button>
            <button onClick={reset} style={{ padding: '14px 18px', background: '#0f1928', color: '#7fa8c4', border: '1.5px solid #1e3460', borderRadius: '10px', fontSize: '15px', cursor: 'pointer' }}>
              חדש
            </button>
          </div>
        )}

        {isLoading && (
          <div style={{ textAlign: 'center', padding: '48px 20px' }}>
            <div style={S.spinner} />
            <p style={{ color: '#2b9dd4', fontWeight: 700, fontSize: '17px', marginBottom: '24px' }}>
              {statusLabel[status]}
            </p>
            <div style={{ background: '#0f1928', borderRadius: '100px', height: '5px', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'linear-gradient(90deg, #09254d, #2b9dd4)', width: `${progress}%`, transition: 'width 0.6s ease', borderRadius: '100px' }} />
            </div>
          </div>
        )}

        {(status === 'idle' || status === 'error') && (
          <>
            <div
              style={S.uploadZone(!!photo)}
              onDrop={onDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
            >
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
              {photo
                ? <><div style={{ fontSize: '28px', marginBottom: '8px' }}>✅</div><p style={{ color: '#2b9dd4', fontWeight: 600 }}>{photoName}</p></>
                : <><div style={{ fontSize: '36px', marginBottom: '10px' }}>📸</div><p style={{ color: '#7fa8c4' }}>גרור תמונה או לחץ להעלאה</p></>
              }
            </div>

            <label style={S.labelStyle}>כותרת ראשית</label>
            <input type="text" value={h1} onChange={e => setH1(e.target.value)} placeholder="التخطيط" dir="rtl" style={S.input} />

            <label style={S.labelStyle}>טקסט ריבון</label>
            <input type="text" value={labelText} onChange={e => setLabelText(e.target.value)} placeholder="كيف نجحت في اول بزنس؟" dir="rtl" style={{ ...S.input, fontSize: '17px' }} />

            {status === 'error' && <div style={S.error}>{errorMsg}</div>}

            <button onClick={generate} disabled={!photo} style={S.btn(!!photo)}>
              {status === 'error' ? 'נסה שוב' : 'צור קאבר'}
            </button>
          </>
        )}
      </div>
    </main>
  )
}

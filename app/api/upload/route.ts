import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  const uploadRes = await fetch('https://storage.fal.ai/files', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${process.env.FAL_KEY}`,
      'Content-Type': file.type || 'image/jpeg',
    },
    body: bytes,
  })

  if (!uploadRes.ok) {
    const text = await uploadRes.text()
    return NextResponse.json({ error: 'FAL upload failed: ' + text }, { status: 500 })
  }

  const data = await uploadRes.json()
  return NextResponse.json({ url: data.url || data.file_url })
}

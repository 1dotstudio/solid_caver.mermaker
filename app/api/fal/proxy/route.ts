import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const targetUrl = req.nextUrl.searchParams.get('url') || 'https://queue.fal.run'
  
  const res = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Key ${process.env.FAL_KEY}`,
    },
    body,
  })
  
  const data = await res.json()
  return NextResponse.json(data)
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 })
  
  const res = await fetch(url, {
    headers: { 'Authorization': `Key ${process.env.FAL_KEY}` },
  })
  
  const data = await res.json()
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest) {
  const body = await req.text()
  const url = req.nextUrl.searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 })
  
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Key ${process.env.FAL_KEY}`,
    },
    body,
  })
  
  const data = await res.json()
  return NextResponse.json(data)
}

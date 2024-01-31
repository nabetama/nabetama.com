import { generateFeed } from 'lib/feed'

export async function GET() {
  const resp = await generateFeed()

  return new Response(resp, {
    headers: {
      'Content-Type': 'application/atom+xml; charset=utf-8',
    },
  })
}

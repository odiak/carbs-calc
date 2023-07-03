export const onRequestGet: PagesFunction = async (context) => {
  const originalRes = await fetch(
    'https://www.mext.go.jp/content/20201225-mxt_kagsei-mext_01110_012.xlsx',
    {
      cf: {
        cacheTtl: 60 * 60,
        cacheEverything: true,
      },
    }
  )

  const res = new Response(originalRes.body, originalRes)
  res.headers.set('Cache-Control', `public, max-age=${60 * 60 * 24 * 365}`)

  return res
}

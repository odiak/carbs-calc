type Item = {
  code: string
  name: string
  carbs: number
}

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url)
  if (url.host === 'carbs-calc.pages.dev') {
    const newUrl = new URL(url)
    newUrl.host = 'carbs-calc.t1ckle.com'
    return Response.redirect(newUrl.toString(), 301)
  }

  const params = url.searchParams
  if (url.pathname !== '/' || params.size === 0) {
    return context.next()
  }

  const selectedItems = (params.get('is') ?? '').split('-').map((s) => {
    const [code, amountStr] = s.split('*', 2)
    const amount = Number(amountStr ?? 0)
    return { code: code ?? '', amount }
  })
  if (selectedItems.length === 0) {
    return context.next()
  }

  const itemsRes = await fetch('https://r2.carbs-calc.odiak.net/data.json', {
    cf: { cacheTtl: 60 * 60 * 24 },
  })
  const { items } = await itemsRes.json<{ items: Item[] }>()

  const totalCarbs = selectedItems
    .map(({ code, amount }) => {
      const item = items.find((item) => item.code === code)
      return ((item?.carbs ?? 0) * amount) / 100
    })
    .reduce((a, b) => a + b, 0)

  let texts: string[] = []

  const note = params.get('n') ?? ''
  if (note !== '') {
    texts.push(`メモ: ${note}`)
  }

  texts.push(`炭水化物量: ${totalCarbs.toFixed(1)}g`)

  const icr = Number(params.get('icr') ?? 0)
  if (icr > 0) {
    const insulin = totalCarbs / icr
    texts.push(`インスリン量: ${insulin.toFixed(2)}U`)
  }

  const description = texts.join('\n')

  return new HTMLRewriter()
    .on('meta[property="og:description"]', {
      element(element) {
        element.setAttribute('content', description)
      },
    })
    .transform(await context.next())
}

import React, { FC, useEffect, useMemo, useState } from 'react'
import {
  Autocomplete,
  Box,
  Button,
  Card,
  FormControl,
  FormHelperText,
  FormLabel,
  Input,
  Link,
  Snackbar,
  Stack,
  Table,
  Textarea,
  Typography,
  styled,
} from '@mui/joy'

import { FilterOptionsState } from '@mui/base/useAutocomplete'

type Item = {
  name: string
  carbs: number
  index: number
  code: string
}

type ItemWithAmount = Item & { amount?: number }

export const App: FC = () => {
  const [items, setItems] = useState<Item[] | undefined>()

  useEffectWithAbortSignal(async (signal) => {
    const items = await getItems(signal)
    setItems(items)
  }, [])

  return (
    <Box sx={{ mx: 'auto', maxWidth: 600, p: 1 }}>
      <Typography
        level="h1"
        fontSize={24}
        mt={2}
        mb={2}
        textAlign="center"
        textColor="neutral.700"
      >
        炭水化物量計算くん
      </Typography>

      <Typography mb={1}>
        いくつか食材を選んでその重量を入力すると、合計の炭水化物量が分かります。
      </Typography>

      <details>
        <summary>
          <Typography display="inline-block" mb={1}>
            もっと詳しく
          </Typography>
        </summary>

        <Card variant="soft" sx={{ mb: 2 }}>
          <Typography mb={1}>
            食材が検索できない場合は、キーワードや表記を変えて試してみてください。
          </Typography>
          <Typography mb={1}>
            このページのリンクを誰かに送ると、内容をシェアすることができます。
            <br />
            (シェアした後に編集しても相手には反映されません。)
          </Typography>
          <Typography>
            <Link href="https://www.mext.go.jp/a_menu/syokuhinseibun/mext_01110.html">
              日本食品標準成分表2020年版(八訂)
            </Link>
            のデータを使用しています。
          </Typography>
        </Card>
      </details>

      {items === undefined ? (
        <p>データを読み込み中です</p>
      ) : (
        <Calculator allItems={items} />
      )}
    </Box>
  )
}

const dataVersion = 2020

const Th = styled('th')``

const Calculator: FC<{ allItems: ItemWithAmount[] }> = ({ allItems }) => {
  const dataFromSearch = useMemo(
    () => decodeSearch(location.search, allItems),
    []
  )

  const [item, setItem] = useState<ItemWithAmount | null>(null)
  const [items, setItems] = useState<ItemWithAmount[]>(
    dataFromSearch?.items ?? []
  )
  const [note, setNote] = useState<string>(dataFromSearch.note)
  const [carbRatio, setCarbRatio] = useState(dataFromSearch.carbRatio)

  const [showingSnackbar, setShowingSnackbar] = useState(false)

  const updateSearch = (
    options: Partial<{
      items: ItemWithAmount[]
      carbRatio: number
      note: string
    }>,
    replace?: boolean
  ) => {
    const path = location.pathname

    const newItems = options.items ?? items
    const newCarbRatio = options.carbRatio ?? carbRatio ?? 0
    const newNote = options.note ?? note

    if (newItems.length === 0 && newCarbRatio === 0) {
      if (replace) {
        history.replaceState(null, '', path)
      } else {
        history.pushState(null, '', path)
      }
      return
    }

    const params = new URLSearchParams({
      is: newItems.map((it) => `${it.code}*${it.amount ?? 0}`).join('-'),
      n: newNote,
    })
    if (newCarbRatio !== 0) {
      params.set('icr', String(newCarbRatio))
    }
    const search = params.toString()

    const url = `${path}?${search}`
    if (replace) {
      history.replaceState(null, '', url)
    } else {
      history.pushState(null, '', url)
    }
  }

  useEffect(() => {
    const onPopState = () => {
      const dataFromSearch = decodeSearch(location.search, allItems)
      setItems(dataFromSearch.items)
      setCarbRatio(dataFromSearch.carbRatio)
      setNote(dataFromSearch.note)
    }
    window.addEventListener('popstate', onPopState)

    const hash = location.hash
    if (hash.length > 2) {
      decodeHash(hash, allItems).then((data) => {
        if (data !== undefined) {
          const { items, carbRatio } = data
          setItems(items)
          setCarbRatio(carbRatio)
          updateSearch({ items, carbRatio }, true)
        }
      })
    }

    return () => {
      window.removeEventListener('popstate', onPopState)
    }
  }, [allItems])

  const setAmount = (i: number, amount: number | undefined) => {
    setItems((items) => {
      const newItems = [...items]
      const item = items[i]
      if (item !== undefined) {
        newItems[i] = { ...item, amount }
      }
      updateSearch({ items: newItems }, true)
      return newItems
    })
  }

  const deleteItem = (i: number) => {
    setItems((items) => {
      const newItems = [...items]
      newItems.splice(i, 1)
      updateSearch({ items: newItems })
      return newItems
    })
  }

  const copyLink = () => {
    navigator.clipboard.writeText(location.href)
    setShowingSnackbar(true)
  }

  const reset = () => {
    setItems([])
    setCarbRatio(0)
    setNote('')
    updateSearch({ items: [], carbRatio: 0, note: '' })
  }

  const getOptionLabel = (item: ItemWithAmount) =>
    `${item.name} (${item.carbs}%)`

  const filterOptions = (
    options: ItemWithAmount[],
    { inputValue }: FilterOptionsState<Item>
  ): ItemWithAmount[] => {
    const trimmedInput = inputValue.trim()

    let filtered: Item[]
    if (trimmedInput === '') {
      filtered = options
    } else {
      const keywords = trimmedInput.split(/\s+/).filter((k) => !/^\d+$/.test(k))
      filtered = options.filter((option) =>
        keywords.every((keyword) =>
          variants(keyword).some((v) => option.name.includes(v))
        )
      )
    }

    // If the input ends with a number, it'll be considered as the amount
    const amountStr = trimmedInput.match(/\s(\d+)$/)?.[1]
    const amount = amountStr === undefined ? undefined : Number(amountStr)

    return filtered.slice(0, 100).map((item) => ({ ...item, amount }))
  }

  const onSelectItem = (item: ItemWithAmount) => {
    setItems((items) => {
      const newItems = [...items, { ...item }]
      updateSearch({ items: newItems })
      return newItems
    })
  }

  const total = items
    .map((item) => ((item.amount ?? 0) * item.carbs) / 100)
    .reduce((sum, c) => sum + c, 0)

  return (
    <>
      <Table
        variant="outlined"
        sx={{
          '& > thead > tr > th': {
            whiteSpace: 'normal',
            verticalAlign: 'middle',
          },
        }}
      >
        <thead>
          <tr>
            <Th
              sx={{
                width: '50%',
                '@media (max-width: 500px)': {
                  width: '30%',
                },
              }}
            >
              食品名
            </Th>
            <th>炭水化物量</th>
            <th>重量</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i}>
              <td>{item.name}</td>
              <td>
                {(((item.amount ?? 0) * item.carbs) / 100).toFixed(1)}g
                <br />({item.carbs}%)
              </td>
              <td>
                <Input
                  fullWidth
                  size="sm"
                  endDecorator="g"
                  slotProps={{
                    input: {
                      type: 'number',
                      min: 0,
                      step: 1,
                      value: item.amount ?? '',
                      onChange: (e) => {
                        const v = e.target.value
                        setAmount(i, v === '' ? undefined : Number(v))
                      },
                    },
                  }}
                />
              </td>
              <td>
                <Button
                  size="sm"
                  color="neutral"
                  variant="solid"
                  onClick={() => deleteItem(i)}
                >
                  削除
                </Button>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={4}>
                <Typography textAlign="center" textColor="neutral.500">
                  食品が追加されていません
                </Typography>
              </td>
            </tr>
          )}
          <tr>
            <td colSpan={4}>
              <Autocomplete
                size="sm"
                options={allItems}
                getOptionLabel={getOptionLabel}
                filterOptions={filterOptions}
                placeholder="追加する食品名を入力してください"
                forcePopupIcon={false}
                blurOnSelect
                value={item}
                onChange={(_, value) => {
                  if (value) {
                    onSelectItem(value)
                    setItem(null)
                  }
                }}
              />
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">合計</th>
            <td>{total.toFixed(1)}g</td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </Table>

      <FormControl sx={{ my: 3 }}>
        <FormLabel>メモ</FormLabel>
        <Textarea
          size="sm"
          slotProps={{
            textarea: {
              value: note,
              onChange: (e) => {
                const newNote = e.target.value
                setNote(newNote)
                updateSearch({ note: newNote })
              },
            },
          }}
        />
      </FormControl>

      <Card variant="soft" size="sm" sx={{ my: 3 }}>
        <FormControl orientation="horizontal">
          <FormLabel>糖質インスリン比</FormLabel>
          <Input
            size="sm"
            endDecorator="g/U"
            slotProps={{
              input: {
                type: 'number',
                min: 0,
                step: 1,
                value: carbRatio ?? '',
                onChange: (e) => {
                  const v = e.target.value
                  const newCarbRatio = v === '' ? undefined : Number(v)
                  setCarbRatio(newCarbRatio)
                  updateSearch({ carbRatio: newCarbRatio ?? 0 })
                },
              },
            }}
          />
        </FormControl>
        {((carbRatio ?? 0) === 0 || items.length === 0) && (
          <FormHelperText>
            糖質インスリン比を設定した状態で食品を選択すると、投与するインスリンの量が下に表示されます
          </FormHelperText>
        )}

        {carbRatio !== undefined && carbRatio !== 0 && items.length !== 0 && (
          <Typography>
            インスリン量: {(total / carbRatio).toFixed(2)}U
          </Typography>
        )}
      </Card>

      <Stack direction="row" spacing={1}>
        <Button size="sm" color="neutral" onClick={reset}>
          リセット
        </Button>
        <Button size="sm" color="neutral" onClick={copyLink}>
          リンクをコピーする
        </Button>
      </Stack>

      <Snackbar
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        open={showingSnackbar}
        onClose={() => setShowingSnackbar(false)}
        autoHideDuration={2000}
      >
        コピーしました
      </Snackbar>
    </>
  )
}

async function decode(str: string): Promise<unknown> {
  const { decode: decodeMsgpack } = await import('@msgpack/msgpack')
  const raw = atob(str)
  return decodeMsgpack(Uint8Array.from([...raw].map((r) => r.charCodeAt(0))))
}

/** for past compatibility */
async function decodeHash(
  hash: string,
  allItems: Item[]
): Promise<{ items: ItemWithAmount[]; carbRatio: number } | undefined> {
  if (hash === '' || hash === '#') return undefined

  try {
    const data = (await decode(hash.slice(1))) as {
      v: number
      carbRatio: number
      items: [number, number][]
    }
    if (data.v !== dataVersion) return

    const items: ItemWithAmount[] = []
    for (const pair of data.items) {
      const [index, amount] = pair
      if (index < 0 || index >= allItems.length) continue
      const item = allItems[index]
      if (item !== undefined) {
        items.push({ ...item, amount })
      }
    }

    return {
      ...data,
      items,
    }
  } catch (e) {
    return undefined
  }
}

function decodeSearch(
  search: string,
  allItems: Item[]
): { items: ItemWithAmount[]; carbRatio: number | undefined; note: string } {
  const params = new URLSearchParams(search)
  const itemsStr = params.get('is') ?? ''
  const carbRatioStr = params.get('icr')
  const note = params.get('n') ?? ''

  const items: ItemWithAmount[] = []
  for (const pair of itemsStr.split('-')) {
    const [code, amountStr] = pair.split('*')
    const amount = Math.max(0, Number(amountStr))
    const item = allItems.find((it) => it.code === code)
    if (Number.isNaN(amount) || item === undefined) continue
    items.push({ ...item, amount })
  }

  const carbRatio = carbRatioStr === null ? undefined : Number(carbRatioStr)

  return { items, carbRatio, note }
}

function useEffectWithAbortSignal(
  effect: (signal: AbortSignal) => void,
  deps: unknown[]
): void {
  useEffect(() => {
    const ac = new AbortController()
    effect(ac.signal)
    return () => {
      ac.abort()
    }
  }, deps)
}

async function getItems(signal?: AbortSignal): Promise<Item[]> {
  const res = await fetch('https://r2.carbs-calc.odiak.net/data.json', {
    signal,
  })
  const { items }: { items: Item[] } = await res.json()
  return items
}

function katakanaToHiragana(str: string): string {
  return str.replace(/[\u30a1-\u30f6]/g, (match) =>
    String.fromCharCode(match.charCodeAt(0) - 0x60)
  )
}

function hiraganaToKatakana(str: string): string {
  return str.replace(/[\u3041-\u3096]/g, (match) =>
    String.fromCharCode(match.charCodeAt(0) + 0x60)
  )
}

function variants(str: string): string[] {
  const hiragana = katakanaToHiragana(str)
  const katakana = hiraganaToKatakana(str)

  return [
    ...new Set(
      [str, hiragana, katakana].flatMap((w) => {
        const s = synonyms.flatMap(([k, alts]) => (k.startsWith(w) ? alts : []))
        return [w, ...s]
      })
    ),
  ]
}

const synonyms = Object.entries({
  ご飯: ['めし'],
  ごはん: ['めし'],
  ライス: ['めし'],

  人参: ['にんじん'],
  大根: ['だいこん'],
  蕪: ['かぶ'],

  片栗粉: ['でん粉類'],
  かたくりこ: ['でん粉類'],
  ホットケーキミックス: ['プレミックス粉　ホットケーキ用'],

  パイナップル: ['パインアップル'],
  桃: ['もも'],
  苺: ['いちご'],

  スキムミルク: ['脱脂粉乳'],
})

import React, { FC, useEffect, useMemo, useState } from 'react'
import { CellObject, read } from 'xlsx'
import { styled } from '../styled-system/jsx'
import {
  decode as decodeMsgpack,
  encode as encodeMsgpack,
} from '@msgpack/msgpack'
import { css } from '../styled-system/css'

type Item = {
  name: string
  carbs: number
  index: number
}

type ItemWithAmount = Item & { amount: number }

export const App: FC = () => {
  const [items, setItems] = useState<Item[] | undefined>()

  useEffectWithAbortSignal(async (signal) => {
    const items = await getItems(signal)
    setItems(items)
  }, [])

  return (
    <styled.div px={2}>
      <styled.h1 fontSize="x-large">炭水化物量計算くん</styled.h1>
      <p>
        いくつか食材を選んでその重量を入力すると、合計の炭水化物量が分かります。
      </p>
      <details className={css({ mb: 4 })}>
        <summary>その他の説明</summary>
        <div
          className={css({
            border: '1px solid',
            borderColor: 'gray.400',
            rounded: 6,
            p: 2,
          })}
        >
          <p>
            食材が検索できない場合は、キーワードや表記を変えて試してみてください。
            <br />
            （例: 片栗粉→でん粉、人参→にんじん）
          </p>
          <p>
            このページのリンクを誰かに送ると、内容をシェアすることができます。
            <br />
            (シェアした後に編集しても相手には反映されません。)
          </p>
          <p>
            <a href="https://www.mext.go.jp/a_menu/syokuhinseibun/mext_01110.html">
              日本食品標準成分表2020年版（八訂）
            </a>
            のデータを使用しています。
          </p>
        </div>
      </details>

      {items === undefined ? (
        <p>データを読み込み中です</p>
      ) : (
        <Calculator allItems={items} />
      )}
    </styled.div>
  )
}

const dataVersion = 2020

const Calculator: FC<{ allItems: Item[] }> = ({ allItems }) => {
  const dataFromHash = useMemo(() => decodeHash(location.hash, allItems), [])

  const [searchText, setSearchText] = useState('')
  const [suggestions, setSuggestions] = useState<Item[]>([])
  const [items, setItems] = useState<ItemWithAmount[]>(
    dataFromHash?.items ?? []
  )
  const [carbRatio, setCarbRatio] = useState(dataFromHash?.carbRatio ?? 0)

  const [showingToast, setShowingToast] = useState(false)

  const updateHash = (items: ItemWithAmount[], carbRatio: number) => {
    if (items.length === 0 && carbRatio === 0) {
      location.hash = ''
      return
    }

    location.hash = encode({
      v: dataVersion,
      carbRatio,
      items: items.map((it) => [it.index, it.amount]),
    })
  }

  useEffect(() => {
    const onHashChange = () => {
      const dataFromHash = decodeHash(location.hash, allItems)
      setItems(dataFromHash?.items ?? [])
      setCarbRatio(dataFromHash?.carbRatio ?? 0)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => {
      window.removeEventListener('hashchange', onHashChange)
    }
  }, [allItems])

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape' && !e.nativeEvent.isComposing) {
      setSuggestions([])
    }
  }

  const updateSearchText = (text: string) => {
    setSearchText(text)

    const trimmedText = text.trim()

    if (trimmedText === '') {
      setSuggestions([])
      return
    }

    const keywords = trimmedText.split(/\s+/)

    setSuggestions(
      allItems.filter((item) => keywords.every((kw) => item.name.includes(kw)))
    )
  }

  const selectItem = (item: Item) => {
    setItems((items) => {
      const newItems = [...items, { ...item, amount: 0 }]
      updateHash(newItems, carbRatio)
      return newItems
    })
    setSearchText('')
    setSuggestions([])
  }

  const setAmount = (i: number, amount: number) => {
    setItems((items) => {
      const newItems = [...items]
      newItems[i] = { ...items[i], amount }
      updateHash(newItems, carbRatio)
      return newItems
    })
  }

  const deleteItem = (i: number) => {
    setItems((items) => {
      const newItems = [...items]
      newItems.splice(i, 1)
      updateHash(newItems, carbRatio)
      return newItems
    })
  }

  const copyLink = () => {
    navigator.clipboard.writeText(location.href)
    setShowingToast(true)
    setTimeout(() => setShowingToast(false), 2000)
  }

  const total = items
    .map((item) => (item.amount * item.carbs) / 100)
    .reduce((sum, c) => sum + c, 0)

  return (
    <>
      <div>
        <styled.input
          type="text"
          value={searchText}
          onChange={(e) => updateSearchText(e.target.value)}
          placeholder="食品名を入力してください"
          onKeyDown={onKeyDown}
          htmlSize={60}
          maxW="95%"
        />
        <div>
          {suggestions.map((item, i) => (
            <div key={i} onClick={() => selectItem(item)}>
              {item.name} ({item.carbs}%)
            </div>
          ))}
        </div>
      </div>
      {items.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>食品名</th>
              <th>炭水化物量(%)</th>
              <th>重量(g)</th>
              <td></td>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i}>
                <td>{item.name}</td>
                <td>{item.carbs}%</td>
                <td>
                  <styled.input
                    type="number"
                    min="0"
                    step="1"
                    value={item.amount}
                    onChange={(e) => setAmount(i, Number(e.target.value || 0))}
                    maxW={50}
                  />
                </td>
                <td>
                  <button onClick={() => deleteItem(i)}>削除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {items.length === 0 ? (
        <p>食品を選択してください</p>
      ) : (
        <>
          <hr />
          <p>合計炭水化物量: {total.toFixed(1)}g</p>
        </>
      )}

      <hr />

      <div>
        <label>
          糖質インスリン比(g/U):{' '}
          <input
            type="number"
            min="0"
            step="1"
            value={carbRatio}
            onChange={(e) => {
              const newCarbRatio = Number(e.target.value || 0)
              setCarbRatio(newCarbRatio)
              updateHash(items, newCarbRatio)
            }}
          />
        </label>
        {carbRatio !== 0 && items.length !== 0 && (
          <p>インスリン量: {(total / carbRatio).toFixed(2)}U</p>
        )}
      </div>

      <hr />

      <button
        onClick={() => {
          location.hash = ''
        }}
        className={css({ mr: 2 })}
      >
        リセット
      </button>
      <button onClick={copyLink}>リンクをコピーする</button>
      {showingToast && (
        <div
          className={css({
            position: 'fixed',
            bottom: 0,
            left: 0,
            width: '100%',
            p: 2,
          })}
        >
          <div
            className={css({
              mx: 'auto',
              bg: 'gray.900',
              color: 'gray.100',
              width: 'max-content',
              p: 2,
              rounded: 4,
            })}
          >
            コピーしました
          </div>
        </div>
      )}
    </>
  )
}

function encode(data: unknown): string {
  const m = encodeMsgpack(data)
  return btoa(String.fromCharCode(...m))
}

function decode(str: string): unknown {
  const raw = atob(str)
  return decodeMsgpack(Uint8Array.from([...raw].map((r) => r.charCodeAt(0))))
}

function decodeHash(hash: string, allItems: Item[]) {
  if (hash === '' || hash === '#') return undefined

  try {
    const data = decode(hash.slice(1)) as {
      v: number
      carbRatio: number
      items: [number, number][]
    }
    if (data.v !== dataVersion) return

    return {
      items: data.items.map(([i, amount]) => ({
        ...allItems[i],
        amount,
      })),
      carbRatio: data.carbRatio,
    }
  } catch (e) {
    return undefined
  }
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
  const res = await fetch('/data', { signal })
  const buf = await res.arrayBuffer()
  const workBook = read(buf)

  const name = workBook.SheetNames[0]
  const sheet = workBook.Sheets[name]

  const items: Item[] = []

  let i = 0
  for (const key of Object.keys(sheet)) {
    if (!key.startsWith('D')) continue
    const name = (sheet[key] as CellObject).w ?? ''

    const row = Number(key.slice(1))
    if (row < 13) continue

    const carbsText = ['Q', 'N', 'P']
      .map((col) => sheet[`${col}${row}`] as CellObject | undefined)
      .map((cell) => cell?.w?.match(/\d+(?:\.\d+)?/)?.[0])
      .find((v) => v !== undefined)
    const carbs = Number(carbsText ?? '0')

    items.push({ name, carbs, index: i })
    i++
  }

  return items
}

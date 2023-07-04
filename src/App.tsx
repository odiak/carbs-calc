import React, { FC, useEffect, useMemo, useState } from 'react'
import { CellObject, read } from 'xlsx'
import { styled } from '../styled-system/jsx'
import {
  decode as decodeMsgpack,
  encode as encodeMsgpack,
} from '@msgpack/msgpack'

type Item = {
  name: string
  carbs: number
  index: number
}

type ItemWithAmount = Item & { amount: number }

export const App: FC = () => {
  const [items, setItems] = useState<Item[] | undefined>()

  useEffect(() => {
    const ac = new AbortController()

    ;(async () => {
      const res = await fetch('/data', { signal: ac.signal })
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

      setItems(items)
    })()

    return () => {
      ac.abort()
    }
  }, [])

  return (
    <styled.div p={2}>
      <h1>炭水化物量計算くん</h1>
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
  const dataFromHash = useMemo(() => {
    const hash = location.hash
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
  }, [])

  const [searchText, setSearchText] = useState('')
  const [suggestions, setSuggestions] = useState<Item[]>([])
  const [items, setItems] = useState<ItemWithAmount[]>(
    dataFromHash?.items ?? []
  )
  const [carbRatio, setCarbRatio] = useState(dataFromHash?.carbRatio ?? 0)

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
          糖質インスリン比:{' '}
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
          <p>インスリン量: {(total / carbRatio).toFixed(2)}</p>
        )}
      </div>
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

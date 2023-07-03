import React, { FC, useCallback, useEffect, useState } from 'react'
import { CellObject, WorkBook, read } from 'xlsx'

type Item = {
  name: string
  carbs: number
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

        items.push({ name, carbs })
      }

      setItems(items)
    })()

    return () => {
      ac.abort()
    }
  }, [])

  return (
    <>
      <h1>炭水化物量計算くん</h1>
      {items === undefined ? (
        <p>データを読み込み中です</p>
      ) : (
        <Calculator allItems={items} />
      )}
    </>
  )
}

const Calculator: FC<{ allItems: Item[] }> = ({ allItems }) => {
  const [searchText, setSearchText] = useState('')
  const [suggestions, setSuggestions] = useState<Item[]>([])
  const [items, setItems] = useState<ItemWithAmount[]>([])

  const updateHash = (items: ItemWithAmount[]) => {}

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
    setItems((items) => [...items, { ...item, amount: 0 }])
    setSearchText('')
    setSuggestions([])
  }

  const setAmount = (i: number, amount: number) => {
    setItems((items) => {
      const newItems = [...items]
      newItems[i] = { ...items[i], amount }
      return newItems
    })
  }

  const deleteItem = (i: number) => {
    setItems((items) => {
      const newItems = [...items]
      newItems.splice(i, 1)
      return newItems
    })
  }

  return (
    <>
      <div>
        <input
          type="text"
          value={searchText}
          onChange={(e) => updateSearchText(e.target.value)}
          placeholder="食品名を入力してください"
          onKeyDown={onKeyDown}
          size={60}
          style={{ maxWidth: '100%' }}
        />
        <div>
          {suggestions.map((item, i) => (
            <div key={i} onClick={() => selectItem(item)}>
              {item.name} ({item.carbs}%)
            </div>
          ))}
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>食品名</th>
            <th>炭水化物量(%)</th>
            <th>重量</th>
            <td></td>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i}>
              <td>{item.name}</td>
              <td>{item.carbs}%</td>
              <td>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={item.amount}
                  onChange={(e) => setAmount(i, Number(e.target.value || 0))}
                />
              </td>
              <td>
                <button onClick={() => deleteItem(i)}>削除</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {items.length === 0 ? (
        <p>食品を選択してください</p>
      ) : (
        <p>
          合計炭水化物量:{' '}
          {items
            .map((item) => (item.amount * item.carbs) / 100)
            .reduce((sum, c) => sum + c, 0)
            .toFixed(1)}
          g
        </p>
      )}
    </>
  )
}

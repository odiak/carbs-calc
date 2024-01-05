#!/usr/bin/env node

import { CellObject, read } from 'xlsx'
import { writeFile } from 'fs/promises'

const chars: Record<string, string> = {
  '　': ' ',
  '（': '(',
  '）': ')',
  '＜': '<',
  '＞': '>',
  '［': '[',
  '］': ']',
}

async function main() {
  const res = await fetch(
    'https://www.mext.go.jp/content/20201225-mxt_kagsei-mext_01110_012.xlsx'
  )
  const buffer = await res.arrayBuffer()
  const workbook = read(buffer)

  const name = workbook.SheetNames[0]
  if (name === undefined) {
    throw new Error('Sheet name is undefined')
  }

  const sheet = workbook.Sheets[name]
  if (sheet === undefined) {
    throw new Error('Sheet is undefined')
  }

  const items: Array<{
    code: string
    name: string
    carbs: number
    index: number
  }> = []

  for (const key of Object.keys(sheet)) {
    if (!key.startsWith('D')) continue
    const name = (sheet[key] as CellObject).w?.replace(
      /[　（）＜＞［］]/g,
      (c) => chars[c] ?? ''
    )

    const row = Number(key.slice(1))
    if (row < 13) continue

    const code = (sheet[`B${row}`] as CellObject).w
    const index = Number((sheet[`C${row}`] as CellObject).w ?? Number.NaN) - 1

    if (name === undefined || code === undefined || Number.isNaN(index))
      continue

    const carbsText = ['Q', 'N', 'P']
      .map((col) => sheet[`${col}${row}`] as CellObject | undefined)
      .map((cell) => cell?.w?.match(/\d+(?:\.\d+)?/)?.[0])
      .find((v) => v !== undefined)
    const carbs = Number(carbsText ?? '0')

    items.push({ code, name, carbs, index })
  }

  const json = JSON.stringify({ items })
  await writeFile('data.json', json)
}

main().catch((error) => {
  console.error(error)
})

import * as fs from "node:fs"
import type { EncodedItem } from './build'

function readEncoded(): EncodedItem[] {
  const encodedString = fs.readFileSync(`.cache/encoded.json`, { encoding: "utf-8"})
  const encoded = <EncodedItem[]>JSON.parse(encodedString)
  return encoded
}

export function sound(name: string): EncodedItem {
  const encoded = readEncoded()
  const item = encoded.find(x => x.source === name)
  if (item === undefined) {
    throw new Error(`No Sound Found For ${name}`)
  }
  return item
}

export function encoded(): EncodedItem[] {
  return readEncoded()
}


if (import.meta.main) {
  const item = sound("rosa10")
  console.log({item})
}

import * as path from "node:path"

export async function build() {
  await encode()
  const result = await Bun.build({
    entrypoints: [
      "src/index.html"
    ],
    outdir: "./dist",
    minify: true,
    sourcemap: "linked",
    splitting: true,
  })

  if (!result.success) {
    console.error(result.logs)
    process.exit(1)
  }

  await Bun.write("dist/service-worker.js", Bun.file("src/service-worker.js"))
  console.log("Build complete")
}

export interface LfsFile {
  readonly name: string
  readonly size: number
  readonly checkout: boolean
  readonly downloaded: boolean
  readonly oid_type: "sha256"
  readonly oid: string
  readonly version: "https://git-lfs.github.com/spec/v1"
}
export interface LFS {
  readonly files: readonly LfsFile[]
}
export interface EncodedItem {
  readonly lfs: LfsFile
  readonly source: string
  readonly outname: string
  readonly outpath: string
  readonly hash: string
}
export async function encode() {

  await Bun.$`mkdir -p dist .cache`
  const lfs = <LFS> await Bun.$`git lfs ls-files --json`.json()
  const files = lfs.files.filter(file => file.name.endsWith(".wav"))

  const saveFile = Bun.file(".cache/encoded.json")
  const encoded = <EncodedItem[]> await saveFile.json().catch(() => [])

  for (const file of files) {
    const source = file.name
    const base = path.basename(source).replace(".wav", "")
    const hash = file.oid.slice(0, 8)
    const ext = "opus"
    const outname = `${base}-${hash}.${ext}`
    const outpath = `dist/${outname}`
    const outfile = Bun.file(outpath)
    if (!await outfile.exists()) {
      await Bun.$`ffmpeg -hide_banner -loglevel error -i ${source} -map_metadata -1 -ar 48000 -c:a libopus -y ${outpath}`
    }

    if (encoded.find(x => x.hash === hash) === undefined) {
      const item = <EncodedItem>{
        hash,
        lfs: file,
        outname,
        outpath,
        source: base
      }
      encoded.push(item)
    }
  }


  const str = JSON.stringify(encoded, null, 2)
  await saveFile.write(str)

  return encoded
}

if (import.meta.main) {
  await build()
}

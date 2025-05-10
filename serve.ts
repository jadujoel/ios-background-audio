import { build } from "./build.ts"
import home from "./src/index.html"

export async function serve() {
  await build()
  const server = Bun.serve({
    async fetch(request, server) {
      console.log(`Request: ${request.url}`)
      if (request.method !== "GET") {
        return new Response("Method not allowed", { status: 405 })
      }
      let pathname = new URL(request.url).pathname
      if (pathname === "/") {
        pathname = "/index.html"
        await build()
      }
      if (pathname === "/favicon.ico") {
        return new Response("", { status: 404 })
      }
      return new Response(Bun.file(`dist${pathname}`))
    },
  })

  console.log(server.url.href)
}

if (import.meta.main) {
  await serve()
}

import "dotenv/config"
import express from "express"
import { getPrices } from "./price.js"

const app = express()

app.use(express.json())
app.use(express.static("public"))

function parseList(text) {
  const raw = typeof text === "string" ? text : ""
  const lines = raw.split("\n")
  const items = []

  for (const line of lines) {
    const m = line.match(/^(\d+)\s+(.+)$/)
    if (!m) continue
    items.push({
      qty: parseInt(m[1], 10),
      name: m[2].trim()
    })
  }

  return items
}

app.post("/calc", async (req, res) => {
  try {
    const items = parseList(req.body?.list ?? "")

    if (items.length === 0) {
      return res.status(400).json({ error: "有効な行がありません" })
    }

    const uniqueCards = [...new Set(items.map(i => i.name))]
    const prices = await getPrices(uniqueCards)

    let total = 0
    const detail = items.map(i => {
      const raw = prices[i.name]
      const isError = raw && typeof raw === "object" && raw.error === true
      // 単価は小数点以下切り捨てしてから小計・合計に使う
      const price = isError ? null : Math.floor(Number(typeof raw === "number" ? raw : 0))
      const subtotal = isError ? null : price * i.qty
      if (!isError) total += subtotal
      return {
        name: i.name,
        qty: i.qty,
        price,
        subtotal,
        error: isError
      }
    })

    return res.json({ total, detail })
  } catch (err) {
    console.error("[calc]", err)
    return res.status(500).json({ error: "サーバーエラーが発生しました" })
  }
})

app.post("/cache/clear", (req, res) => {
  try {
    clearCache()
    return res.json({ ok: true })
  } catch (err) {
    console.error("[cache/clear]", err)
    return res.status(500).json({ error: "サーバーエラーが発生しました" })
  }
})

app.use((err, req, res, next) => {
  console.error("[express]", err)
  res.status(500).json({ error: "サーバーエラーが発生しました" })
})

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`listening on port ${PORT}`)
})

process.on("unhandledRejection", (reason, promise) => {
  console.error("[unhandledRejection]", reason)
})
import "dotenv/config"
import express from "express"
import { getPrices } from "./price.js"


const app = express()

app.use(express.json())
app.use(express.static("public"))

function parseList(text) {

  const lines = text.split("\n")

  const items = []

  for (const line of lines) {

    const m = line.match(/^(\d+)\s+(.+)$/)

    if (!m) continue

    items.push({
      qty: parseInt(m[1]),
      name: m[2]
    })
  }

  return items
}

app.post("/calc", async (req, res) => {

  const items = parseList(req.body.list)

  const uniqueCards = [...new Set(items.map(i => i.name))]

  const prices = await getPrices(uniqueCards)

  let total = 0

  const detail = items.map(i => {

    const price = prices[i.name] || 0

    const subtotal = price * i.qty

    total += subtotal

    return {
      name: i.name,
      qty: i.qty,
      price,
      subtotal
    }
  })

  res.json({
    total,
    detail
  })
})

const PORT = process.env.PORT || 3000

app.listen(PORT)
import axios from "axios"
import { parseStringPromise } from "xml2js"
import CryptoJS from "crypto-js"
import { getCache, setCache } from "./cache.js"

const API_URL = "http://wonder.wisdom-guild.net/api/card-price/v1/"

const API_KEY = process.env.API_KEY
const SECRET_KEY = process.env.SECRET_KEY

const LAND_NAME_MAP = {
  "平地": "Plains",
  "島": "Island",
  "沼": "Swamp",
  "山": "Mountain",
  "森": "Forest",
  "荒地": "Wastes",

  "冠雪の平地": "Snow-Covered Plains",
  "冠雪の島": "Snow-Covered Island",
  "冠雪の沼": "Snow-Covered Swamp",
  "冠雪の山": "Snow-Covered Mountain",
  "冠雪の森": "Snow-Covered Forest"
}
const BASIC_LANDS = new Set([
  "Plains",
  "Island",
  "Swamp",
  "Mountain",
  "Forest",
  "Wastes",
  "Snow-Covered Plains",
  "Snow-Covered Island",
  "Snow-Covered Swamp",
  "Snow-Covered Mountain",
  "Snow-Covered Forest"
])

function normalizeCardName(name) {

  const trimmed = name.trim()

  if (LAND_NAME_MAP[trimmed]) {
    return LAND_NAME_MAP[trimmed]
  }

  return trimmed
}

function makeSignature(params) {
  const sorted = Object.keys(params)
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join("\n")

  const sig = CryptoJS.HmacSHA256(sorted, SECRET_KEY)
  return sig.toString(CryptoJS.enc.Hex)
}

async function fetchCard(card) {
  const normalized = normalizeCardName(card)

  if (BASIC_LANDS.has(normalized)) {
    return 0
  }

  const cacheHit = getCache(normalized)
  if (cacheHit) return cacheHit

  const params = {
    api_key: API_KEY,
    name: encodeURIComponent(normalized),
    timestamp: Math.floor(Date.now() / 1000)
  }

  params.api_sig = makeSignature(params)

  const url =
    API_URL +
    "?" +
    Object.entries(params)
      .map(([k, v]) => `${k}=${v}`)
      .join("&")

  const res = await axios.get(url)

  const parsed = await parseStringPromise(res.data)

const item =
  parsed?.response?.contents?.[0]?.["api-results"]?.[0]?.items?.[0]?.item?.[0]

if (!item) {
  return 0
}

const values = item.Price?.[0]?.statistics?.[0]?.value || []

const trim = values.find(v => v.$?.type === "trimmean")

if (!trim) return 0

const price = parseFloat(trim._)

  setCache(card, price)

  return price
}

export async function getPrices(cards) {

  const promises = cards.map(c => fetchCard(c))

  const prices = await Promise.all(promises)

  const result = {}

  cards.forEach((c, i) => {
    result[c] = prices[i]
  })

  return result
}
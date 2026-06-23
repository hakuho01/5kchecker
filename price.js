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

function toComparable(value) {
  return String(value || "").trim().toLowerCase()
}

function getItemNameCandidates(item) {
  const keys = ["card", "name", "Name", "name_en", "name_jp", "card_name"]
  const names = []

  // item.$.key に英名が入るケースがある
  const keyName = item?.$?.key
  if (typeof keyName === "string" && keyName.trim()) {
    names.push(keyName)
  }

  // Card[0].CardnameFull[0] にカード名が入るケースがある
  const cardNameFull = item?.Card?.[0]?.CardnameFull?.[0]
  if (typeof cardNameFull === "string" && cardNameFull.trim()) {
    names.push(cardNameFull)
  }

  // phase[0].cardname[0].en[0] / ja[0] から取得できるケースがある
  const phaseCardname = item?.Card?.[0]?.phase?.[0]?.cardname?.[0]
  const phaseEn = phaseCardname?.en?.[0]
  if (typeof phaseEn === "string" && phaseEn.trim()) {
    names.push(phaseEn)
  }

  const phaseJa = phaseCardname?.ja?.[0]
  if (typeof phaseJa === "string" && phaseJa.trim()) {
    names.push(phaseJa)
  } else if (phaseJa && typeof phaseJa === "object") {
    const phaseJaText = phaseJa._
    if (typeof phaseJaText === "string" && phaseJaText.trim()) {
      names.push(phaseJaText)
    }
  }

  for (const key of keys) {
    const v = item?.[key]?.[0]
    if (typeof v === "string" && v.trim()) {
      names.push(v)
    }
  }

  return names
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

// 202 が返ってきた場合のリトライ設定（処理中なので待って再試行する）
const MAX_RETRIES = 5
const RETRY_DELAY_MS = 2000

async function fetchCard(card) {
  const normalized = normalizeCardName(card)

  if (BASIC_LANDS.has(normalized)) {
    return 0
  }

  const cacheHit = getCache(normalized)
  if (cacheHit) return cacheHit

  // 空白は RFC 1738 に従い + でエンコード（Wisdom Guild API 仕様）
  const nameEncoded = encodeURIComponent(normalized).replace(/%20/g, "+")

  try {
    let res
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      // timestamp / 署名はリクエストごとに再生成する
      const params = {
        api_key: API_KEY,
        name: nameEncoded,
        timestamp: Math.floor(Date.now() / 1000)
      }
      params.api_sig = makeSignature(params)

      const url =
        API_URL +
        "?" +
        Object.entries(params)
          .map(([k, v]) => `${k}=${v}`)
          .join("&")

      res = await axios.get(url, { timeout: 15000, validateStatus: () => true })

      // 202 = 受付済みだが集計処理中。少し待って再試行する。
      if (res.status === 202) {
        if (attempt < MAX_RETRIES) {
          console.info(
            `[price] ${normalized}: API returned 202 (processing), retrying (${attempt + 1}/${MAX_RETRIES})`
          )
          await sleep(RETRY_DELAY_MS)
          continue
        }
        console.warn(`[price] ${normalized}: still 202 after ${MAX_RETRIES} retries`)
        return { error: true }
      }

      break
    }

    if (res.status !== 200) {
      console.warn(`[price] ${normalized}: API returned ${res.status}`)
      return { error: true }
    }

    const parsed = await parseStringPromise(res.data)
    const items =
      parsed?.response?.contents?.[0]?.["api-results"]?.[0]?.items?.[0]?.item || []

    if (!Array.isArray(items) || items.length === 0) {
      return 0
    }

    const target = toComparable(normalized)
    const item = items.find(candidate =>
      getItemNameCandidates(candidate).some(name => toComparable(name) === target)
    )

    if (!item) {
      return 0
    }

    const values = item.Price?.[0]?.statistics?.[0]?.value || []
    const trim = values.find(v => v.$?.type === "trimmean")

    if (!trim) return 0

    const price = parseFloat(trim._)
    setCache(normalized, price)
    return price
  } catch (err) {
    console.warn(`[price] ${normalized}:`, err.message || err)
    return { error: true }
  }
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
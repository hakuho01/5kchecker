export function trimmedMean(values, ratio = 0.2) {

  if (!values.length) return 0

  const sorted = [...values].sort((a, b) => a - b)

  const trim = Math.floor(sorted.length * ratio)

  const sliced = sorted.slice(trim, sorted.length - trim)

  const sum = sliced.reduce((a, b) => a + b, 0)

  return sum / sliced.length
}
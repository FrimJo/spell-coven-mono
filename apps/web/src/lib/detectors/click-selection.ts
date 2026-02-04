import type { BoundingBox, Point } from '@/types/card-query'

export type ClickSelectableCard = {
  box: BoundingBox
  score: number
}

export function selectCardAtClick(
  cards: ClickSelectableCard[],
  clickPoint: Point,
  frameWidth: number,
  frameHeight: number,
): { card: ClickSelectableCard; index: number } | null {
  let bestIndex = -1
  let bestScore = -Infinity

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]
    if (!card) continue
    const box = card.box

    const boxXMin = box.xmin * frameWidth
    const boxYMin = box.ymin * frameHeight
    const boxXMax = box.xmax * frameWidth
    const boxYMax = box.ymax * frameHeight

    const isInside =
      clickPoint.x >= boxXMin &&
      clickPoint.x <= boxXMax &&
      clickPoint.y >= boxYMin &&
      clickPoint.y <= boxYMax

    if (!isInside) continue

    const boxWidth = boxXMax - boxXMin
    const boxHeight = boxYMax - boxYMin
    const area = boxWidth * boxHeight
    const canvasArea = frameWidth * frameHeight

    const centerX = boxXMin + boxWidth / 2
    const centerY = boxYMin + boxHeight / 2
    const dx = clickPoint.x - centerX
    const dy = clickPoint.y - centerY
    const distance = Math.hypot(dx, dy)
    const maxDistance = Math.hypot(frameWidth, frameHeight)
    const distanceScore = (1 - distance / maxDistance) * 200000

    const areaPercentage = area / canvasArea
    const sizeScore = Math.pow(1 - areaPercentage, 3) * 100000
    const confidenceScore = card.score * 1000000

    const totalScore = distanceScore + sizeScore + confidenceScore

    if (totalScore > bestScore) {
      bestScore = totalScore
      bestIndex = i
    }
  }

  if (bestIndex === -1) {
    return null
  }

  const selectedCard = cards[bestIndex]
  if (!selectedCard) {
    return null
  }

  return { card: selectedCard, index: bestIndex }
}

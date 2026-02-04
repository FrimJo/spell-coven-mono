import type { BBoxCropOptions, CropRegion } from './detectors/geometry/crop'
import {
  enhanceCanvasContrast,
  getQueryContrastEnhancement,
  getQueryTargetSize,
} from './clip-search'
import { cropAndCenterToSquare } from './detectors/geometry/crop'

export function prepareCardQueryCanvas(
  sourceCanvas: HTMLCanvasElement,
  region: CropRegion,
  cropOptions: BBoxCropOptions = {},
): HTMLCanvasElement {
  const contrast = getQueryContrastEnhancement()
  const targetSize = getQueryTargetSize()
  const croppedCanvas = cropAndCenterToSquare(sourceCanvas, region, {
    targetSize,
    highQuality: true,
    ...cropOptions,
  })
  return enhanceCanvasContrast(croppedCanvas, contrast)
}

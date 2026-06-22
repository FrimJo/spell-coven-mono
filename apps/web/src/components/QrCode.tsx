import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

interface QrCodeProps {
  value: string
  size?: number
  className?: string
}

export function QrCode({ value, size = 240, className }: QrCodeProps) {
  const [svg, setSvg] = useState<string>('')

  useEffect(() => {
    let cancelled = false

    QRCode.toString(value, {
      type: 'svg',
      margin: 1,
      width: size,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#111827',
        light: '#ffffff',
      },
    })
      .then((nextSvg) => {
        if (!cancelled) {
          setSvg(nextSvg)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSvg('')
        }
      })

    return () => {
      cancelled = true
    }
  }, [size, value])

  return (
    <div
      className={['[&_svg]:block [&_svg]:size-full', className]
        .filter(Boolean)
        .join(' ')}
      style={{
        width: size,
        height: size,
        maxWidth: '100%',
        maxHeight: '100%',
      }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

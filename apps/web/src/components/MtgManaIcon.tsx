import type { MtgColorTheme } from '../contexts/ThemeContext'

const MANA_STYLES: Record<
  Exclude<MtgColorTheme, 'none'>,
  {
    bg: string
    text: string
    stroke: string
    label: string
  }
> = {
  white: {
    bg: '#F8F6E8',
    text: '#1F2937',
    stroke: '#D4D4D8',
    label: 'W',
  },
  blue: {
    bg: '#1D4ED8',
    text: '#E0F2FE',
    stroke: '#60A5FA',
    label: 'U',
  },
  black: {
    bg: '#111827',
    text: '#F9FAFB',
    stroke: '#374151',
    label: 'B',
  },
  red: {
    bg: '#DC2626',
    text: '#FEF2F2',
    stroke: '#F87171',
    label: 'R',
  },
  green: {
    bg: '#16A34A',
    text: '#ECFDF5',
    stroke: '#4ADE80',
    label: 'G',
  },
}

interface MtgManaIconProps {
  theme: Exclude<MtgColorTheme, 'none'>
  className?: string
  title?: string
}

export function MtgManaIcon({ theme, className, title }: MtgManaIconProps) {
  const styles = MANA_STYLES[theme]

  return (
    <svg
      aria-hidden={title ? undefined : true}
      className={className}
      role={title ? 'img' : 'presentation'}
      viewBox="0 0 24 24"
    >
      {title ? <title>{title}</title> : null}
      <circle
        cx="12"
        cy="12"
        r="10"
        fill={styles.bg}
        stroke={styles.stroke}
        strokeWidth="1.5"
      />
      <text
        x="12"
        y="12"
        fill={styles.text}
        fontSize="10"
        fontWeight="700"
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="'Inter', 'Segoe UI', sans-serif"
      >
        {styles.label}
      </text>
    </svg>
  )
}

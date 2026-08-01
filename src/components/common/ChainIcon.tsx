import React, { useState } from 'react'
import { hashStringToColor } from './colorHash'

export interface ChainIconProps {
  logo?: string
  name: string
  color?: string
  size?: number
}

export const ChainIcon: React.FC<ChainIconProps> = ({ logo, name, color, size = 24 }) => {
  const [imgFailed, setImgFailed] = useState(false)
  const showImage = Boolean(logo) && !imgFailed
  const fallbackColor = color || hashStringToColor(name)

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: showImage ? undefined : fallbackColor,
      }}
    >
      {showImage && (
        <img
          src={logo}
          alt={name}
          width={size}
          height={size}
          className="h-full w-full rounded-full object-cover"
          onError={() => setImgFailed(true)}
        />
      )}
    </span>
  )
}

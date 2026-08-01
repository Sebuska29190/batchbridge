import React, { useState } from 'react'
import { hashStringToColor } from './colorHash'

export interface TokenIconProps {
  logoURI?: string
  symbol: string
  size?: number
  chainLogoURI?: string
}

export const TokenIcon: React.FC<TokenIconProps> = ({
  logoURI,
  symbol,
  size = 28,
  chainLogoURI,
}) => {
  const [imgFailed, setImgFailed] = useState(false)
  const showImage = Boolean(logoURI) && !imgFailed
  const badgeSize = Math.round(size * 0.4)

  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: showImage ? undefined : hashStringToColor(symbol),
      }}
    >
      {showImage ? (
        <img
          src={logoURI}
          alt={symbol}
          width={size}
          height={size}
          className="h-full w-full rounded-full object-cover"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span
          className="select-none font-medium leading-none text-white"
          style={{ fontSize: Math.max(9, Math.round(size * 0.38)) }}
        >
          {symbol.slice(0, 2).toUpperCase()}
        </span>
      )}
      {chainLogoURI && (
        <img
          src={chainLogoURI}
          alt=""
          width={badgeSize}
          height={badgeSize}
          className="chainbadge absolute bottom-0 right-0 rounded-full border-2 border-[var(--surface)] object-cover"
          style={{ width: badgeSize, height: badgeSize }}
        />
      )}
    </span>
  )
}

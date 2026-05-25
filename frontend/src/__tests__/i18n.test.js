import { describe, it, expect } from 'vitest'
import { t, setLocale, getLocale, translations } from '../i18n'

describe('i18n', () => {
  it('default locale is en', () => {
    expect(getLocale()).toBe('en')
  })

  it('returns translation key when translation missing', () => {
    expect(t('nonexistent.key')).toBe('nonexistent.key')
  })

  it('returns EN translation for known key', () => {
    expect(t('hero.title')).toBe(translations.en.hero.title)
  })

  it('switches to PL locale', () => {
    setLocale('pl')
    expect(getLocale()).toBe('pl')
    expect(t('hero.cta')).toBe('Rozpocznij')
    setLocale('en')
  })

  it('has all keys in both locales', () => {
    const enKeys = Object.keys(translations.en).sort()
    const plKeys = Object.keys(translations.pl).sort()
    expect(enKeys).toEqual(plKeys)
  })
})

describe('formatUsd', () => {
  it('can be imported without error', async () => {
    const mod = await import('../bridgeService')
    expect(typeof mod.formatUsd).toBe('function')
  })
})

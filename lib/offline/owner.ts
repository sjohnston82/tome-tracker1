'use client'
import { createContext, createElement, useContext, useEffect, type ReactNode } from 'react'
const Owner = createContext<string | null>(null)
export function CacheOwnerProvider({ userId, children }: { userId: string | null; children: ReactNode }) {
  useEffect(() => { if (typeof caches !== 'undefined') void caches.delete('library-sync').catch(() => {}) }, [userId])
  return createElement(Owner.Provider, { value: userId }, children)
}
export const useCacheOwner = () => useContext(Owner)

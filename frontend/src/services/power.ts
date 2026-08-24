// =========================================================
// POWER SERVICE — Llamadas de control de energía al backend
// =========================================================

import { api } from './api'

export interface PowerStatus {
  driver:      string
  enabled:     boolean
  supportsOn:  boolean
  supportsOff: boolean
  offVia:      'os' | 'device'
}

export const getPowerStatus = async (): Promise<PowerStatus> => {
  const { data } = await api.get<PowerStatus>('/api/power')
  return data
}

export const powerOn = async (): Promise<{ success: boolean; message: string }> => {
  const { data } = await api.post<{ success: boolean; message: string }>('/api/power/on')
  return data
}

export const powerOff = async (): Promise<{ success: boolean; message: string }> => {
  const { data } = await api.post<{ success: boolean; message: string }>('/api/power/off')
  return data
}

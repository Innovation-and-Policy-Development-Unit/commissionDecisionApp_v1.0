import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
}

export const pushSupported = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window

/**
 * Web Push subscription state + actions. Handles permission, subscribing via the
 * service worker's pushManager, and registering the subscription with the API.
 */
export default function usePushNotifications() {
  const [supported] = useState(pushSupported)
  const [permission, setPermission] = useState(
    () => (typeof Notification !== 'undefined' ? Notification.permission : 'default'),
  )
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!supported) return
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      setSubscribed(Boolean(sub))
    } catch { /* SW not ready yet */ }
  }, [supported])

  useEffect(() => { refresh() }, [refresh])

  const enable = useCallback(async () => {
    setError('')
    if (!supported) { setError('This device or browser does not support push notifications.'); return false }
    setBusy(true)
    try {
      const { data } = await api.get('/push/vapid-public-key/')
      if (!data?.enabled || !data?.public_key) {
        setError('Push notifications are not configured on the server.')
        return false
      }
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') { setError('Notification permission was not granted.'); return false }

      const reg = await navigator.serviceWorker.ready
      let sub = await reg.pushManager.getSubscription()
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(data.public_key),
        })
      }
      const json = sub.toJSON()
      await api.post('/push-subscriptions/', {
        endpoint: json.endpoint,
        p256dh_key: json.keys?.p256dh,
        auth_key: json.keys?.auth,
      })
      setSubscribed(true)
      return true
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Could not enable notifications.')
      return false
    } finally {
      setBusy(false)
    }
  }, [supported])

  const disable = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) await sub.unsubscribe()
      setSubscribed(false)
      return true
    } catch (err) {
      setError(err?.message || 'Could not disable notifications.')
      return false
    } finally {
      setBusy(false)
    }
  }, [])

  return { supported, permission, subscribed, busy, error, enable, disable, refresh }
}

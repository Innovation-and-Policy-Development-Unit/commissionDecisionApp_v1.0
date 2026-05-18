const DB_NAME = 'MeetingAudioDB'
const DB_VERSION = 1
const STORE_NAME = 'audioChunks'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
        store.createIndex('sessionId', 'sessionId', { unique: false })
        store.createIndex('sequence', 'sequence', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveChunk(sessionId, chunk, sequence) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).add({ sessionId, chunk, sequence, timestamp: Date.now() })
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export async function getChunks(sessionId) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const index = tx.objectStore(STORE_NAME).index('sessionId')
    const req = index.getAll(IDBKeyRange.only(sessionId))
    req.onsuccess = () => {
      const records = (req.result || []).sort((a, b) => a.sequence - b.sequence)
      const chunks = records.map(r => r.chunk)
      db.close()
      resolve(chunks)
    }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

export async function clearSession(sessionId) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const index = tx.objectStore(STORE_NAME).index('sessionId')
    const req = index.openCursor(IDBKeyRange.only(sessionId))
    req.onsuccess = () => {
      const cursor = req.result
      if (cursor) {
        tx.objectStore(STORE_NAME).delete(cursor.primaryKey)
        cursor.continue()
      }
    }
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export async function getAllSessions() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).getAll()
    req.onsuccess = () => {
      db.close()
      const records = req.result || []
      const map = {}
      for (const r of records) {
        if (!map[r.sessionId]) {
          map[r.sessionId] = { sessionId: r.sessionId, count: 0, firstChunk: r.timestamp, size: 0 }
        }
        map[r.sessionId].count++
        map[r.sessionId].size += r.chunk.size
        if (r.timestamp < map[r.sessionId].firstChunk) {
          map[r.sessionId].firstChunk = r.timestamp
        }
      }
      resolve(Object.values(map).sort((a, b) => b.firstChunk - a.firstChunk))
    }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

/**
 * nchat — 文件传输模块（从 peer.js 拆分）
 * 负责：文件元信息广播、分片探测与发送、入站分片聚合、LCAN 存储、缩略图生成
 */
import { sha256Hex, sign, verify as edVerify } from './crypto.js'
import { buildMessage, MsgType, BinKind } from './protocol.js'
import { addHolder, getHolders } from './db.js'

// 文件传输常量（从 peer.js 拷贝）
const FILE_BIN_CONCURRENCY = 3
const FILE_CHUNK_HEADER_MARGIN = 64
const PULL_CHUNK_SIZE = 65536

const DEBUG = false
function dbg(...args) {
  if (DEBUG) console.log('[nchat]', ...args)
}

// 本地缓存（发送端）
let _outgoingFiles = new Map() // fileId -> { room, arrayBuffer, name, type, size, totalHashHex, fileSig, chunkSize, totalChunks, originalFrom }
// 入站聚合（接收端）
let _fileChunks = new Map() // fileId -> { total, chunks: Map, meta, firstSeen }

/** 生成缩略图（仅图片） */
async function makeThumbnailFromBlob(file, maxDim = 160) {
  return new Promise((resolve) => {
    if (!file.type?.startsWith('image/')) { resolve(null); return }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(maxDim / img.width, maxDim / img.height, 1)
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', 0.6))
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
    img.src = url
  })
}

/**
 * 发送文件消息（入口，由 PeerNetwork.sendFileMessage 调用）
 * @param {PeerNetwork} net
 * @param {string} room
 * @param {File} file
 */
export async function sendFileMessage(net, room, file) {
  if (!net._localRoomsSet.has(room)) {
    await net.joinRoom(room)
  }
  const MAX_FILE_SIZE = 100 * 1024 * 1024
  if (file.size > MAX_FILE_SIZE) {
    net._emit('error', { type: 'file_too_large', message: `文件超过 100MB 限制（当前 ${(file.size / 1024 / 1024).toFixed(1)}MB）` })
    return false
  }

  const arrayBuffer = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })

  const fileId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
  const totalHashHex = sha256Hex(arrayBuffer)
  const fileSig = await sign(net.identity.privateKey, fileId + ':' + totalHashHex)

  let thumbDataUrl = null
  if (file.type && file.type.startsWith('image/')) {
    thumbDataUrl = await makeThumbnailFromBlob(file)
  }

  net._sentFileIds.add(fileId)
  if (!_outgoingFiles) _outgoingFiles = new Map()
  _outgoingFiles.set(fileId, {
    room,
    arrayBuffer,
    name: file.name,
    type: file.type,
    size: file.size,
    totalHashHex,
    fileSig,
    chunkSize: 0,
    totalChunks: 0,
    originalFrom: net.identity.peerId
  })
  addHolder('file:' + fileId, net.identity.peerId)
  if (_outgoingFiles.size > 20) {
    const oldest = _outgoingFiles.keys().next().value
    _outgoingFiles.delete(oldest)
  }

  const localBlobUrl = URL.createObjectURL(new Blob([arrayBuffer], { type: file.type || 'application/octet-stream' }))
  net._emit('chat', {
    id: fileId,
    room,
    from: net.identity.peerId,
    name: net.ownName,
    file: {
      name: file.name,
      type: file.type,
      size: file.size,
      blobUrl: localBlobUrl,
      fileId,
      fromPeerId: net.identity.peerId,
      totalHashHex,
      isMeta: false,
      isLocal: true
    },
    timestamp: Date.now()
  })

  const meta = await buildMessage({
    type: MsgType.FILE_META,
    from: net.identity.peerId,
    to: room,
    payload: {
      room,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      fileId,
      thumbDataUrl,
      totalHashHex,
      fileSig,
      bin: true
    },
    extensions: { name: net.ownName }
  }, net.identity.privateKey)
  net._markProcessed(meta.id)
  await net._broadcast(meta)

  net.lcanStore('file', fileId, {
    room,
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
    fileId,
    totalHashHex,
    fileSig,
    from: net.identity.peerId,
    name: net.ownName
  }).catch(() => {})

  net._pushFileChunks(fileId).catch((e) => {
    console.warn('[nchat] push file chunks failed:', e?.message)
  })
  return true
}

/** 向所有在线 peer 推送分片（bin 通道） */
export async function _pushFileChunks(net, fileId) {
  const entry = _outgoingFiles?.get(fileId)
  if (!entry) return
  const targets = []
  for (const [connKey, conn] of net.connections) {
    if (!conn.peerId) continue
    if (conn.binStatus !== 'online') continue
    targets.push(connKey)
  }
  if (targets.length === 0) return
  await Promise.allSettled(
    targets.map((ck) => _pushFileChunksToPeer(net, ck, fileId, entry))
  )
}

/** 向单个 peer 推送：探测能力 → 自适应分片 → 并发发送 */
export async function _pushFileChunksToPeer(net, connKey, fileId, entry) {
  const { arrayBuffer, totalHashHex, fileSig, name, type, size, room } = entry
  const cap = await net._probeCapability(connKey)
  const chunkSize = Math.max(1024, cap - FILE_CHUNK_HEADER_MARGIN)
  const total = Math.ceil(arrayBuffer.byteLength / chunkSize)
  entry.chunkSize = chunkSize
  entry.totalChunks = total

  for (let start = 0; start < total; start += FILE_BIN_CONCURRENCY) {
    const end = Math.min(start + FILE_BIN_CONCURRENCY, total)
    const tasks = []
    for (let i = start; i < end; i++) {
      const offset = i * chunkSize
      const len = Math.min(chunkSize, arrayBuffer.byteLength - offset)
      const buf = arrayBuffer.slice(offset, offset + len)
      tasks.push(
        net._sendBinary(connKey, {
          kind: BinKind.FILE_CHUNK,
          fileId,
          index: i,
          total,
          chunkSize,
          totalHashHex,
          fileSig,
          from: net.identity.peerId,
          fileName: name,
          fileType: type,
          fileSize: size,
          room,
          name: net.ownName,
          buf
        })
      )
    }
    await Promise.all(tasks)
  }
}

/** 处理入站 FILE_CHUNK（bin 通道） */
export async function _onFileChunkBin(net, connKey, data) {
  const { fileId, index, total, chunkSize, totalHashHex, fileSig, from, fileName, fileType, fileSize, room, name } = data
  if (!fileId || typeof index !== 'number' || typeof total !== 'number') return

  const entry = net.connections.get(connKey)
  if (!entry) return
  entry.lastSeen = Date.now()

  if (!net._fileChunks) net._fileChunks = new Map()
  let agg = net._fileChunks.get(fileId)
  if (!agg) {
    agg = {
      total,
      chunks: new Map(),
      meta: { fileName, fileType, fileSize, from, name, timestamp: data.timestamp },
      firstSeen: Date.now()
    }
    net._fileChunks.set(fileId, agg)
  }
  if (!agg.chunks.has(index)) {
    agg.chunks.set(index, data.buf)
    if (agg.chunks.size === total) {
      const buffers = []
      for (let i = 0; i < total; i++) {
        const buf = agg.chunks.get(i)
        if (!buf) { console.warn('[nchat] missing chunk', fileId, i); return }
        buffers.push(buf)
      }
      const full = new Blob(buffers)
      const actualHash = await sha256Hex(await full.arrayBuffer())
      if (actualHash !== totalHashHex) {
        console.warn('[nchat] file hash mismatch', fileId)
        return
      }
      const blobUrl = URL.createObjectURL(full)
      net._emit('chat', {
        id: fileId,
        room,
        from,
        name: name || from.slice(0, 8),
        file: {
          name: fileName,
          type: fileType,
          size: fileSize,
          blobUrl,
          fileId,
          fromPeerId: from,
          totalHashHex,
          isMeta: false,
          isLocal: false
        },
        timestamp: Date.now()
      })
      net.lcanStore('file', fileId, agg.meta).catch(() => {})
      net._fileChunks.delete(fileId)
    }
  }
}

/** 组装完整文件：验总哈希 → Blob URL → 发射 chat 事件。 */
export async function _assembleFile(net, fileId, agg) {
  const { total, chunkSize, totalHashHex, fileSig, from, chunks, meta } = agg
  // 拼接 ArrayBuffer
  const parts = []
  let totalLen = 0
  for (let i = 0; i < total; i++) {
    const p = chunks.get(i)
    if (!p) {
      console.warn('[nchat] file assemble: missing chunk', fileId, i)
      net._emit('file:unavailable', { fileId, from })
      return
    }
    parts.push(p)
    totalLen += p.byteLength
  }
  const combined = new Uint8Array(totalLen)
  let offset = 0
  for (const p of parts) {
    combined.set(new Uint8Array(p), offset)
    offset += p.byteLength
  }

  // 验总哈希
  const hashHex = sha256Hex(combined.buffer)
  if (hashHex !== totalHashHex) {
    console.warn('[nchat] file hash mismatch, discard', fileId)
    net._emit('file:unavailable', { fileId, from })
    return
  }
  // 验签名（fileId + ':' + totalHashHex，由原始发送者私钥签署）
  const sigOk = await edVerify(from, fileSig, fileId + ':' + totalHashHex)
  if (!sigOk) {
    console.warn('[nchat] file signature invalid, discard', fileId)
    net._emit('file:unavailable', { fileId, from })
    return
  }

  // 创建 Blob URL（全程无 base64，零膨胀）
  const mime = meta.fileType || 'application/octet-stream'
  const blob = new Blob([combined.buffer], { type: mime })
  const blobUrl = URL.createObjectURL(blob)

  // 缓存为 holder（发送者离线后，本节点可向其他节点提供该文件）
  if (!net._outgoingFiles) net._outgoingFiles = new Map()
  net._outgoingFiles.set(fileId, {
    room: meta.room,
    arrayBuffer: combined.buffer,
    name: meta.fileName,
    type: meta.fileType,
    size: meta.fileSize,
    totalHashHex,
    fileSig,
    chunkSize,
    totalChunks: total,
    originalFrom: from, // 原始发送者 peerId（fileSig 验签用）
    isHolder: true
  })
  addHolder('file:' + fileId, net.identity.peerId)

  // 发射 chat 事件（替换 meta 卡片为完整内容）
  net._emit('chat', {
    id: fileId,
    room: meta.room,
    from: meta.from,
    name: meta.name,
    file: {
      name: meta.fileName,
      type: meta.fileType,
      size: meta.fileSize,
      blobUrl,
      fileId,
      fromPeerId: from,
      totalHashHex,
      isMeta: false
    },
    timestamp: meta.timestamp
  })
  dbg('file:assembled', fileId, totalLen, 'bytes')
}

/** 处理 FILE_REQUEST（对端请求分片重发） */
export async function _onFileRequest(net, connKey, msg) {
  const { fileId, indices } = msg.payload || {}
  if (!fileId || !Array.isArray(indices)) return
  const entry = _outgoingFiles?.get(fileId)
  if (!entry) return
  const { arrayBuffer, chunkSize, totalChunks, totalHashHex, fileSig, name, type, size, room } = entry
  for (const i of indices) {
    if (i < 0 || i >= totalChunks) continue
    const offset = i * chunkSize
    const len = Math.min(chunkSize, arrayBuffer.byteLength - offset)
    const buf = arrayBuffer.slice(offset, offset + len)
    await net._sendBinary(connKey, {
      kind: BinKind.FILE_CHUNK,
      fileId,
      index: i,
      total: totalChunks,
      chunkSize,
      totalHashHex,
      fileSig,
      from: net.identity.peerId,
      fileName: name,
      fileType: type,
      fileSize: size,
      room,
      name: net.ownName,
      buf
    })
  }
}
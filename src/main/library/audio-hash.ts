// Identity of a FILE, deliberately distinct from identity of the music (DESIGN-SPEC §3.7).
//
// The hash covers the audio stream only, with every metadata region excluded, so that retagging a
// file does not change its hash and a moved or renamed file is still recognisably the same file.
// AcoustID answers a different question — "is this the same recording?" — and is a hint elsewhere.

import { createHash } from 'node:crypto'
import { open, type FileHandle } from 'node:fs/promises'

export type HashAlgo = 'flac-streaminfo-md5' | 'sha256-frames' | 'sha256-file'

export interface AudioHash {
  hash: Buffer
  algo: HashAlgo
}

const HASH_CHUNK = 1 << 20

/** Reads FLAC's STREAMINFO MD5 of the decoded audio — already in the file, free and exact. */
async function flacStreaminfoMd5(fh: FileHandle): Promise<AudioHash | null> {
  const head = Buffer.alloc(4)
  await fh.read(head, 0, 4, 0)
  if (head.toString('latin1') !== 'fLaC') return null

  let offset = 4
  for (;;) {
    const header = Buffer.alloc(4)
    const { bytesRead } = await fh.read(header, 0, 4, offset)
    if (bytesRead < 4) return null

    const isLast = (header[0]! & 0x80) !== 0
    const blockType = header[0]! & 0x7f
    const blockLen = (header[1]! << 16) | (header[2]! << 8) | header[3]!
    offset += 4

    if (blockType === 0) {
      // STREAMINFO: the decoded-audio MD5 occupies the final 16 bytes of the block.
      if (blockLen < 34) return null
      const md5 = Buffer.alloc(16)
      await fh.read(md5, 0, 16, offset + blockLen - 16)
      // An all-zero MD5 means the encoder declined to compute one.
      if (md5.every((b) => b === 0)) return null
      return { hash: md5, algo: 'flac-streaminfo-md5' }
    }

    if (isLast) return null
    offset += blockLen
  }
}

/** Size of a leading ID3v2 tag, or 0 if there is none. */
async function id3v2Length(fh: FileHandle): Promise<number> {
  const b = Buffer.alloc(10)
  const { bytesRead } = await fh.read(b, 0, 10, 0)
  if (bytesRead < 10 || b.toString('latin1', 0, 3) !== 'ID3') return 0

  // Syncsafe integer: 7 significant bits per byte.
  const size = ((b[6]! & 0x7f) << 21) | ((b[7]! & 0x7f) << 14) | ((b[8]! & 0x7f) << 7) | (b[9]! & 0x7f)
  const footer = (b[5]! & 0x10) !== 0 ? 10 : 0
  return 10 + size + footer
}

/** Combined size of trailing APEv2 and ID3v1 tags, or 0 if there are none. */
async function trailerLength(fh: FileHandle, fileSize: number): Promise<number> {
  let trailer = 0

  if (fileSize >= 128) {
    const b = Buffer.alloc(3)
    await fh.read(b, 0, 3, fileSize - 128)
    if (b.toString('latin1') === 'TAG') trailer = 128
  }

  const apeFooterAt = fileSize - trailer - 32
  if (apeFooterAt >= 0) {
    const b = Buffer.alloc(32)
    await fh.read(b, 0, 32, apeFooterAt)
    if (b.toString('latin1', 0, 8) === 'APETAGEX') {
      const tagSize = b.readUInt32LE(12)
      const flags = b.readUInt32LE(20)
      const hasHeader = (flags & 0x80000000) !== 0
      trailer += tagSize + (hasHeader ? 32 : 0)
    }
  }

  return trailer
}

async function hashRange(fh: FileHandle, start: number, end: number): Promise<Buffer> {
  const h = createHash('sha256')
  const buf = Buffer.alloc(HASH_CHUNK)
  let pos = start
  while (pos < end) {
    const want = Math.min(HASH_CHUNK, end - pos)
    const { bytesRead } = await fh.read(buf, 0, want, pos)
    if (bytesRead <= 0) break
    h.update(buf.subarray(0, bytesRead))
    pos += bytesRead
  }
  return h.digest()
}

/**
 * Hashes a media file's audio content. FLAC gets its embedded decoded-audio MD5; tagged container
 * formats get their frame region hashed with metadata excluded; anything else falls back to a
 * whole-file hash, which is still stable under moves but not under retagging.
 */
export async function hashAudio(path: string): Promise<AudioHash> {
  const fh = await open(path, 'r')
  try {
    const { size } = await fh.stat()

    const flac = await flacStreaminfoMd5(fh)
    if (flac) return flac

    const start = await id3v2Length(fh)
    const trailer = await trailerLength(fh, size)
    const end = size - trailer

    if (end <= start) return { hash: await hashRange(fh, 0, size), algo: 'sha256-file' }

    const tagged = start > 0 || trailer > 0
    return {
      hash: await hashRange(fh, start, end),
      algo: tagged ? 'sha256-frames' : 'sha256-file'
    }
  } finally {
    await fh.close()
  }
}

export const hashToHex = (h: Buffer): string => h.toString('hex')

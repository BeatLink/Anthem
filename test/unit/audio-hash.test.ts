// The audio content hash is what makes the database the source of truth: a file that moves, gets
// renamed, or gets retagged must remain recognisably the same file (DESIGN-SPEC §3.7).

import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { mkdtemp, rm, writeFile, rename } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { hashAudio } from '@main/library/audio-hash'

let dir: string

/** A minimal but structurally valid FLAC: 'fLaC' + STREAMINFO block with a known MD5. */
function flacWith(md5: Buffer, audio: Buffer): Buffer {
  const streaminfo = Buffer.alloc(34)
  streaminfo.writeUInt16BE(4096, 0)   // min block size
  streaminfo.writeUInt16BE(4096, 2)   // max block size
  md5.copy(streaminfo, 18)
  const header = Buffer.from([0x00, 0x00, 0x00, 0x22]) // type 0, length 34
  const last = Buffer.from([0x81, 0x00, 0x00, 0x04])   // last block, padding
  return Buffer.concat([Buffer.from('fLaC'), header, streaminfo, last, Buffer.alloc(4), audio])
}

/** ID3v2.4 header with a syncsafe size, followed by frames and an optional ID3v1 trailer. */
function mp3With(tagBytes: number, audio: Buffer, id3v1 = false): Buffer {
  const header = Buffer.alloc(10)
  header.write('ID3', 0, 'latin1')
  header[3] = 4
  const size = tagBytes
  header[6] = (size >> 21) & 0x7f
  header[7] = (size >> 14) & 0x7f
  header[8] = (size >> 7) & 0x7f
  header[9] = size & 0x7f

  const parts = [header, Buffer.alloc(tagBytes, 0x61), audio]
  if (id3v1) {
    const v1 = Buffer.alloc(128)
    v1.write('TAG', 0, 'latin1')
    parts.push(v1)
  }
  return Buffer.concat(parts)
}

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'anthem-hash-'))
})

afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('audio content hash', () => {
  it('uses the FLAC STREAMINFO MD5, which is already in the file', async () => {
    const md5 = Buffer.from('0123456789abcdef0123456789abcdef', 'hex')
    const p = join(dir, 'a.flac')
    await writeFile(p, flacWith(md5, Buffer.alloc(2048, 7)))

    const h = await hashAudio(p)
    expect(h.algo).toBe('flac-streaminfo-md5')
    expect(h.hash.toString('hex')).toBe(md5.toString('hex'))
  })

  it('ignores an all-zero STREAMINFO MD5, which means the encoder computed none', async () => {
    const p = join(dir, 'zero.flac')
    await writeFile(p, flacWith(Buffer.alloc(16), Buffer.alloc(2048, 7)))

    const h = await hashAudio(p)
    expect(h.algo).not.toBe('flac-streaminfo-md5')
  })

  it('is unchanged when an ID3v2 tag grows, since only frames are hashed', async () => {
    const audio = Buffer.alloc(4096, 0x5a)
    const small = join(dir, 'small.mp3')
    const large = join(dir, 'large.mp3')
    await writeFile(small, mp3With(64, audio))
    await writeFile(large, mp3With(8192, audio))

    const a = await hashAudio(small)
    const b = await hashAudio(large)
    expect(a.algo).toBe('sha256-frames')
    expect(b.hash.toString('hex')).toBe(a.hash.toString('hex'))
  })

  it('is unchanged when an ID3v1 trailer is added', async () => {
    const audio = Buffer.alloc(4096, 0x33)
    const without = join(dir, 'no-v1.mp3')
    const with_ = join(dir, 'with-v1.mp3')
    await writeFile(without, mp3With(64, audio))
    await writeFile(with_, mp3With(64, audio, true))

    const a = await hashAudio(without)
    const b = await hashAudio(with_)
    expect(b.hash.toString('hex')).toBe(a.hash.toString('hex'))
  })

  it('is unchanged by a rename, which is what move detection depends on', async () => {
    const audio = Buffer.alloc(1024, 0x11)
    const before = join(dir, 'before.mp3')
    const after = join(dir, 'deep-renamed.mp3')
    await writeFile(before, mp3With(32, audio))

    const a = await hashAudio(before)
    await rename(before, after)
    const b = await hashAudio(after)

    expect(b.hash.toString('hex')).toBe(a.hash.toString('hex'))
  })

  it('distinguishes different audio content', async () => {
    const x = join(dir, 'x.mp3')
    const y = join(dir, 'y.mp3')
    await writeFile(x, mp3With(32, Buffer.alloc(2048, 1)))
    await writeFile(y, mp3With(32, Buffer.alloc(2048, 2)))

    const a = await hashAudio(x)
    const b = await hashAudio(y)
    expect(b.hash.toString('hex')).not.toBe(a.hash.toString('hex'))
  })
})

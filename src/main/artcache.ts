// One place decides where cached art lives, so the protocol handler and the resolver agree.

import { join } from 'node:path'
import { app } from 'electron'

export const artCacheDir = (): string => join(app.getPath('userData'), 'artwork')

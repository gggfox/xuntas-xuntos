import { compile } from '@inlang/paraglide-js'
import { paraglideOptions } from '../paraglide.config.mjs'

/**
 * The offline compile, for typecheck and tests: they need `src/paraglide` on
 * disk and do not go through Vite. Same options as the plugin — see
 * paraglide.config.mjs for why that matters.
 */
await compile(paraglideOptions)

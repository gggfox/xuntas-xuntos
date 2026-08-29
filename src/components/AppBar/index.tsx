import AccountNav from './AccountNav'
import BrandLink from './BrandLink'

/**
 * App header. Solid ink, yellow brand mark, no shadows.
 * It is the same one as in portal_xuntas.html — recognizable from the first pixel.
 *
 * The bar is two halves that never talk to each other: the brand on the left
 * is the same for everyone, the nav on the right is the only part that knows
 * whether anyone is signed in. This file owns nothing but the band that holds
 * them apart.
 */
export default function AppBar() {
  return (
    <header className="bg-ink text-white">
      <div className="band flex items-center justify-between gap-4 py-[15px]">
        <BrandLink />
        <AccountNav />
      </div>
    </header>
  )
}

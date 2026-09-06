import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * `/administracion` is the app's one layout route: a guard, the cycle
 * selector and the sub-nav wrapped around whatever page sits underneath. A
 * page only appears there because that layout renders an `<Outlet />`.
 *
 * Flat file names decide that nesting silently — `a.b.$id.tsx` becomes a
 * child of `a.b.tsx` — so an admin page can end up parented to another
 * *page* rather than to the layout. Nothing fails when it does: the URL
 * changes, the match is made, and the parent page stays on screen
 * unchanged, which from the outside is a button that does nothing.
 *
 * So this walks the generated tree rather than trusting the file names, and
 * holds every ancestor of an admin page to the one thing that makes its
 * child visible.
 */
const tree = readFileSync(new URL('../src/routeTree.gen.ts', import.meta.url), 'utf8')

const fileOf = new Map<string, string>()
for (const [, name, file] of tree.matchAll(/import \{ Route as (\w+) \} from '\.\/routes\/([^']+)'/g)) {
  fileOf.set(name, file)
}

const parentOf = new Map<string, string>()
const idOf = new Map<string, string>()
for (const [, id, self, parent] of tree.matchAll(
  /'([^']+)': \{\n\s*id: '[^']*'\n[\s\S]*?preLoaderRoute: typeof (\w+)\n\s*parentRoute: typeof (\w+)\n/g,
)) {
  parentOf.set(id, parent)
  idOf.set(self.replace(/Import$/, ''), id)
}

function ancestorFiles(id: string) {
  const files: string[] = []
  for (let name = parentOf.get(id); name && name !== 'rootRouteImport'; name = parentOf.get(idOf.get(name) ?? '')) {
    const file = fileOf.get(name) ?? fileOf.get(`${name}Import`)
    if (!file) throw new Error(`no route file for ${name}`)
    files.push(file)
  }
  return files
}

const adminPages = [...parentOf.keys()].filter((id) => id.startsWith('/administracion/'))

describe('admin routes', () => {
  it('reads the generated tree', () => {
    // Named loosely on purpose: un-nesting a page renames its route id
    // (`registros_/$id`), and this check exists to prove the walk below is
    // looking at real routes, not to pin one id down.
    const detail = adminPages.find((id) => /registros.*\$id/.test(id))
    expect(detail).toBeDefined()
    expect(ancestorFiles(detail!).length).toBeGreaterThan(0)
  })

  it.each(adminPages)('%s renders inside ancestors that render it', (id) => {
    for (const file of ancestorFiles(id)) {
      const source = readFileSync(new URL(`../src/routes/${file}.tsx`, import.meta.url), 'utf8')
      expect(source, `${file} is an ancestor of ${id} but renders no <Outlet />`).toMatch(/<Outlet\b/)
    }
  })
})

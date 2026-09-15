import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

type Props = {
  body: string
  /** Comments: emphasis, links and lists only. A heading inside a thread is a layout bug waiting to happen. */
  inlineOnly?: boolean
  className?: string
}

/**
 * The one markdown renderer, for posts, comments and — once the editor
 * lands — the bitácora. `react-markdown` renders no raw HTML unless told
 * to, which is the sanitising the spec asks for: a pasted `<script>` is
 * text. The subset is the spec's §7; anything wider needs a reason.
 */
const BLOCK: Components = {
  h1: ({ children }) => <h2 className="mt-5 font-disp text-[19px] font-bold first:mt-0">{children}</h2>,
  h2: ({ children }) => <h2 className="mt-5 font-disp text-[19px] font-bold first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-4 font-disp text-[16px] font-bold">{children}</h3>,
  h4: ({ children }) => <h3 className="mt-4 font-disp text-[16px] font-bold">{children}</h3>,
  h5: ({ children }) => <h3 className="mt-4 font-disp text-[16px] font-bold">{children}</h3>,
  h6: ({ children }) => <h3 className="mt-4 font-disp text-[16px] font-bold">{children}</h3>,
  p: ({ children }) => <p className="my-3 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="my-3 grid list-disc gap-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 grid list-decimal gap-1 pl-5">{children}</ol>,
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-yel-line pl-4 font-light text-ink-3 italic">{children}</blockquote>
  ),
  a: ({ href, children }) => (
    <a href={href} className="break-words underline" target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-[13.5px]">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b border-line-2 px-2 py-1.5 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="border-b border-line px-2 py-1.5 align-top">{children}</td>,
  img: () => null,
  hr: () => null,
  code: ({ children }) => <span>{children}</span>,
  pre: ({ children }) => <p className="my-3">{children}</p>,
}

const INLINE: Components = {
  ...BLOCK,
  h1: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  h2: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  h3: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  h4: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  h5: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  h6: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  table: () => null,
  blockquote: ({ children }) => <div className="my-2">{children}</div>,
}

export default function Markdown({ body, inlineOnly = false, className = '' }: Props) {
  return (
    <div className={`text-[14.5px] leading-relaxed font-light ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={inlineOnly ? INLINE : BLOCK} skipHtml={false}>
        {body}
      </ReactMarkdown>
    </div>
  )
}

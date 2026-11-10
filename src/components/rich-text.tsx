import { Fragment } from 'react'

/**
 * Renders a sentence that may reference the publication's contact address. The
 * text is plain (never HTML) and the address becomes a mailto link; when no
 * address is configured the caller's fallback label is shown instead.
 */
export function EmailParagraph({ text, email, fallback }: { text: string; email?: string | null; fallback: string }) {
  const parts = text.split('{{email}}')
  if (parts.length === 1) return <p>{text}</p>
  return (
    <p>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {part}
          {index < parts.length - 1 ? email ? <a href={`mailto:${email}`}>{email}</a> : fallback : null}
        </Fragment>
      ))}
    </p>
  )
}

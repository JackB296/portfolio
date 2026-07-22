/**
 * Renders a schema.org JSON-LD document as a <script> tag. Centralizes the
 * `dangerouslySetInnerHTML` + `JSON.stringify` boilerplate so pages just pass
 * data (built in lib/structuredData.ts).
 */
export default function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

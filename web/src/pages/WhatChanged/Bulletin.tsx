import { DownloadButton } from "../../components/DownloadButton";
import { parseBulletin, type BulletinBlock } from "./bulletinMarkdown";

function BlockView({ block }: { block: BulletinBlock }) {
  if (block.kind === "list") {
    return (
      <ul>
        {block.items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    );
  }
  if (block.kind === "paragraph") return <p>{block.text}</p>;
  return block.level === 2 ? <h3>{block.text}</h3> : <h4>{block.text}</h4>;
}

export function BulletinBody({ markdown }: { markdown: string }) {
  return (
    <div className="bulletin__body">
      {parseBulletin(markdown).map((block, index) => (
        <BlockView key={index} block={block} />
      ))}
    </div>
  );
}

export function Bulletin({ markdown }: { markdown: string }) {
  return (
    <section aria-labelledby="bulletin-heading">
      <h2 id="bulletin-heading">Bulletin</h2>
      <BulletinBody markdown={markdown} />
      <div className="page-actions">
        <details className="bulletin__source">
          <summary>Copy markdown source</summary>
          <label htmlFor="bulletin-markdown" className="visually-hidden">
            Bulletin markdown
          </label>
          <textarea id="bulletin-markdown" readOnly rows={10} value={markdown} />
        </details>
        <DownloadButton
          label="Download bulletin"
          filename="weekly-bulletin.md"
          mimeType="text/markdown"
          content={() => markdown}
        />
      </div>
    </section>
  );
}

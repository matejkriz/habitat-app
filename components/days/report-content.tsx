import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import styles from "./report-content.module.css";

export function ReportContent({ content }: { content: string }) {
  // Older Slack imports used typographic bullets instead of Markdown list markers.
  const markdown = content
    .replace(/^(\s*)•[ \t]+/gm, "$1- ")
    .replace(/^(Fotky(?: z výletu)?):[ \t]+(https?:\/\/[^\s<>]+)[ \t]*$/gim, "[$1](<$2>)");

  return (
    <div className={styles.content}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          h1: "h5", h2: "h5", h3: "h5", h4: "h5", h5: "h5", h6: "h6",
          a: ({ href, children, title }) => href ? (
            <a href={href} title={title} target="_blank" rel="noopener noreferrer">{children}</a>
          ) : <span>{children}</span>,
          img: ({ alt }) => alt ? <span>{alt}</span> : null,
        }}
      >
        {markdown}
      </Markdown>
    </div>
  );
}

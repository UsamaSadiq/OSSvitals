import { Fragment } from "react";

const BACKTICK = "`";

// Text from the pipeline marks inline code with backticks, which Streamlit renders as markdown.
export function CodeText({ text }: { text: string }) {
  const parts = text.split(BACKTICK);
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? <code key={index}>{part}</code> : <Fragment key={index}>{part}</Fragment>,
      )}
    </>
  );
}

interface DownloadButtonProps {
  label: string;
  filename: string;
  mimeType: string;
  content: () => string;
}

function saveFile(filename: string, mimeType: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function DownloadButton({ label, filename, mimeType, content }: DownloadButtonProps) {
  return (
    <button type="button" className="button-link" onClick={() => saveFile(filename, mimeType, content())}>
      {label}
    </button>
  );
}

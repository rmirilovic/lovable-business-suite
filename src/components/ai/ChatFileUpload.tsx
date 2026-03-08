import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, X, FileText, Image as ImageIcon, FileSpreadsheet } from "lucide-react";

export interface FileAttachment {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
  textContent?: string;
}

const ACCEPTED_TYPES = ".txt,.doc,.docx,.xls,.xlsx,.pdf,.jpg,.jpeg,.png,.bmp,.webp";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/bmp", "image/webp"];
const TEXT_TYPES = ["text/plain"];

function getFileIcon(type: string) {
  if (IMAGE_TYPES.includes(type)) return <ImageIcon className="w-3.5 h-3.5" />;
  if (type.includes("spreadsheet") || type.includes("excel") || type.includes(".sheet"))
    return <FileSpreadsheet className="w-3.5 h-3.5" />;
  return <FileText className="w-3.5 h-3.5" />;
}

export function readFileAsAttachment(file: File): Promise<FileAttachment> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_FILE_SIZE) {
      reject(new Error(`Fajl "${file.name}" je prevelik (maks. 10MB)`));
      return;
    }

    if (TEXT_TYPES.includes(file.type) || file.name.endsWith(".txt")) {
      const textReader = new FileReader();
      textReader.onload = () => {
        resolve({
          name: file.name,
          type: file.type || "text/plain",
          size: file.size,
          dataUrl: "",
          textContent: textReader.result as string,
        });
      };
      textReader.onerror = () => reject(new Error(`Greška pri čitanju fajla "${file.name}"`));
      textReader.readAsText(file);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl: reader.result as string,
        });
      };
      reader.onerror = () => reject(new Error(`Greška pri čitanju fajla "${file.name}"`));
      reader.readAsDataURL(file);
    }
  });
}

interface ChatFileUploadProps {
  files: FileAttachment[];
  onFilesChange: (files: FileAttachment[]) => void;
  disabled?: boolean;
}

export function ChatFileUpload({ files, onFilesChange, disabled }: ChatFileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected) return;

    const newFiles: FileAttachment[] = [];
    for (const file of Array.from(selected)) {
      try {
        const attachment = await readFileAsAttachment(file);
        newFiles.push(attachment);
      } catch (err: any) {
        // toast is handled by parent
        console.error(err.message);
      }
    }
    onFilesChange([...files, ...newFiles]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col gap-1">
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-1">
          {files.map((file, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted text-xs max-w-[200px]"
            >
              {getFileIcon(file.type)}
              <span className="truncate">{file.name}</span>
              <button
                onClick={() => removeFile(i)}
                className="ml-0.5 p-0.5 rounded hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="shrink-0 h-11 w-11"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        title="Dodaj fajl"
      >
        <Paperclip className="w-4 h-4" />
      </Button>
    </div>
  );
}

export function isImageType(mimeType: string): boolean {
  return IMAGE_TYPES.includes(mimeType);
}

export function buildMessageContent(
  text: string,
  files: FileAttachment[]
): string | Array<{ type: string; text?: string; image_url?: { url: string } }> {
  if (files.length === 0) return text;

  const parts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];

  // Add text file contents to the text
  let combinedText = text;
  const nonImageFiles = files.filter((f) => !isImageType(f.type));
  for (const file of nonImageFiles) {
    if (file.textContent) {
      combinedText += `\n\n--- Sadržaj fajla: ${file.name} ---\n${file.textContent}`;
    } else {
      combinedText += `\n\n--- Priložen fajl: ${file.name} (${file.type}) ---`;
      // For PDFs and office docs, include base64 for potential processing
      if (file.dataUrl) {
        combinedText += `\n[Fajl je priložen kao binarni sadržaj]`;
      }
    }
  }

  parts.push({ type: "text", text: combinedText });

  // Add images as image_url parts
  const imageFiles = files.filter((f) => isImageType(f.type));
  for (const img of imageFiles) {
    if (img.dataUrl) {
      parts.push({ type: "image_url", image_url: { url: img.dataUrl } });
    }
  }

  return parts.length === 1 && parts[0].type === "text" ? combinedText : parts;
}

export function getDisplayText(files: FileAttachment[], text: string): string {
  if (files.length === 0) return text;
  const fileNames = files.map((f) => `📎 ${f.name}`).join("\n");
  return `${fileNames}\n\n${text}`;
}

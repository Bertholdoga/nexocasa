'use client';

import {
  Camera,
  Download,
  FileAudio,
  FileImage,
  FileText,
  Mic,
  Paperclip,
  Square,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import type { Attachment } from '@/lib/finance';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'audio/webm',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/x-m4a',
]);

function readableSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

function FilePreview({ file }: { file: File }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => {
    return () => URL.revokeObjectURL(url);
  }, [url]);

  if (file.type.startsWith('audio/')) {
    return (
      // This is a private recording selected or created by the user; no caption
      // track exists at preview time.
      // oxlint-disable-next-line jsx-a11y/media-has-caption
      <audio
        className="mt-2 h-9 w-full"
        controls
        preload="metadata"
        src={url}
      />
    );
  }
  if (file.type.startsWith('image/')) {
    return (
      // This is a local, user-selected preview rather than a remote asset.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={`Prévia de ${file.name}`}
        className="mt-2 h-24 w-full rounded-lg object-cover"
      />
    );
  }
  return null;
}

function AttachmentIcon({ contentType }: { contentType: string }) {
  if (contentType.startsWith('audio/')) return <FileAudio className="size-4" />;
  if (contentType.startsWith('image/')) return <FileImage className="size-4" />;
  return <FileText className="size-4" />;
}

export function AttachmentComposer({
  existing,
  pendingFiles,
  onPendingFilesChange,
  onDownload,
  onDelete,
  onError,
  disabled = false,
}: {
  existing: Attachment[];
  pendingFiles: File[];
  onPendingFilesChange: (files: File[]) => void;
  onDownload: (attachment: Attachment) => Promise<void>;
  onDelete: (attachment: Attachment) => Promise<void>;
  onError: (message: string) => void;
  disabled?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);

  useEffect(
    () => () => {
      if (recorderRef.current?.state === 'recording')
        recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  function addFiles(files: File[]) {
    const valid = files.filter((file) => {
      if (file.size > MAX_FILE_SIZE) {
        onError(`${file.name} ultrapassa o limite de 10 MB.`);
        return false;
      }
      if (!ACCEPTED_TYPES.has(file.type)) {
        onError(`${file.name} não é um formato aceito.`);
        return false;
      }
      return true;
    });
    if (pendingFiles.length + valid.length > 5) {
      onError('Anexe no máximo cinco arquivos por lançamento.');
      return;
    }
    onPendingFilesChange([...pendingFiles, ...valid]);
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      onError('A gravação de áudio não é suportada neste navegador.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const preferred = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';
      const recorder = new MediaRecorder(
        stream,
        preferred ? { mimeType: preferred } : undefined,
      );
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || 'audio/webm';
        const extension = type.includes('ogg') ? 'ogg' : 'webm';
        const blob = new Blob(chunksRef.current, { type });
        const file = new File(
          [blob],
          `audio-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`,
          { type },
        );
        addFiles([file]);
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        setRecording(false);
      };
      recorder.start();
      setRecording(true);
    } catch {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      recorderRef.current = null;
      setRecording(false);
      onError('Não foi possível acessar o microfone. Verifique a permissão.');
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }

  return (
    <section className="rounded-2xl border border-[#dfe9e5] bg-[#f7faf9] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-[#183c38]">
            <Paperclip className="size-4 text-[#0b7f71]" /> Comprovantes
          </p>
          <p className="mt-1 text-xs leading-5 text-[#718681]">
            Foto, PDF ou áudio. Você revisa tudo antes de salvar.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip /> Arquivo
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => cameraInputRef.current?.click()}
          >
            <Camera /> Foto
          </Button>
          <Button
            type="button"
            size="sm"
            variant={recording ? 'destructive' : 'outline'}
            disabled={disabled}
            onClick={() =>
              recording ? stopRecording() : void startRecording()
            }
          >
            {recording ? <Square /> : <Mic />}
            {recording ? 'Parar' : 'Gravar'}
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="sr-only"
        accept="image/jpeg,image/png,image/webp,application/pdf,audio/*"
        aria-label="Selecionar comprovantes"
        onChange={(event) => {
          addFiles(Array.from(event.target.files ?? []));
          event.target.value = '';
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        className="sr-only"
        accept="image/*"
        capture="environment"
        aria-label="Fotografar comprovante"
        onChange={(event) => {
          addFiles(Array.from(event.target.files ?? []));
          event.target.value = '';
        }}
      />

      {(pendingFiles.length > 0 || existing.length > 0) && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {pendingFiles.map((file, index) => (
            <div
              key={`${file.name}-${file.lastModified}`}
              className="rounded-xl bg-white p-3"
            >
              <div className="flex items-center gap-2">
                <AttachmentIcon contentType={file.type} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold">{file.name}</p>
                  <p className="text-[11px] text-[#718681]">
                    {readableSize(file.size)} · aguardando salvamento
                  </p>
                </div>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  aria-label={`Remover ${file.name}`}
                  onClick={() =>
                    onPendingFilesChange(
                      pendingFiles.filter(
                        (_, itemIndex) => itemIndex !== index,
                      ),
                    )
                  }
                >
                  <Trash2 />
                </Button>
              </div>
              <FilePreview file={file} />
            </div>
          ))}
          {existing.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center gap-2 rounded-xl bg-white p-3"
            >
              <AttachmentIcon contentType={attachment.contentType} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">
                  {attachment.fileName}
                </p>
                <p className="text-[11px] text-[#718681]">
                  {readableSize(attachment.sizeBytes)} · salvo
                </p>
              </div>
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label={`Baixar ${attachment.fileName}`}
                onClick={() => void onDownload(attachment)}
              >
                <Download />
              </Button>
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label={`Excluir ${attachment.fileName}`}
                onClick={() => void onDelete(attachment)}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Paperclip, Upload, X } from "lucide-react";
import { toast } from "sonner";

const MAX_MB = 50;

export type MaterialValue = {
  storage_path?: string | null;
  /** Nombre visible del archivo (se guarda en `contenido`) */
  nombre?: string | null;
};

/**
 * Sube cualquier tipo de documento (pdf, pptx, docx, xlsx, imágenes, zip, etc.)
 * al almacén privado de material didáctico y devuelve su ruta.
 */
export function MaterialUpload({
  value,
  onChange,
}: {
  value: MaterialValue;
  onChange: (v: MaterialValue) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`El archivo supera los ${MAX_MB} MB.`);
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.includes(".") ? file.name.split(".").pop() : "";
      const path = `${crypto.randomUUID()}${ext ? `.${ext}` : ""}`;
      const { error } = await supabase.storage
        .from("course-materials")
        .upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (error) throw error;
      onChange({ storage_path: path, nombre: file.name });
      toast.success("Material subido");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo subir el archivo");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      {value.storage_path ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm">
          <span className="flex min-w-0 items-center gap-2">
            <Paperclip className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate">{value.nombre ?? "Archivo adjunto"}</span>
          </span>
          <div className="flex shrink-0 gap-1">
            <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
              Reemplazar
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onChange({ storage_path: null, nombre: null })}
              disabled={uploading}
            >
              <X className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Subiendo…</>
          ) : (
            <><Upload className="mr-2 h-4 w-4" /> Subir documento</>
          )}
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        Acepta PDF, Word, PowerPoint, Excel, imágenes, ZIP y otros formatos (máx. {MAX_MB} MB).
      </p>
    </div>
  );
}

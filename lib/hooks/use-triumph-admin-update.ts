"use client";

import { useState } from "react";

import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_LABEL } from "@/lib/validation/addon-songs";
import { postTriumphProjectUpdateAction } from "@/lib/services/triumph-admin-actions";
import type { TriumphProjectStatus } from "@/lib/validation/triumph-update";

// Direct-to-storage upload for the engineer's deliverable attachments,
// mirroring use-booking-flow.ts's addon-songs upload section exactly: the
// same 60s timeout safety net (a real production bug once left customers
// stuck on "Submitting…" forever past Supabase Storage's enforced 50MB
// Free-tier cap) and the same MAX_FILE_SIZE_BYTES import rather than a
// duplicated constant.

const UPLOAD_TIMEOUT_MS = 60_000;
const ALLOWED_MIME_TYPES = new Set([
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/vnd.wave",
  "audio/mpeg",
  "audio/mp3",
  "video/mp4",
]);

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("upload_timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function isAllowedAudioFile(file: File): boolean {
  return ALLOWED_MIME_TYPES.has(file.type) || /\.(wav|mp3|mp4)$/i.test(file.name);
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

export type PostUpdateStatus = "idle" | "uploading" | "saving" | "error" | "success";

export function useTriumphAdminUpdate(projectId: string) {
  const [status, setStatus] = useState<PostUpdateStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function submit(params: {
    body: string;
    statusAfter: TriumphProjectStatus | null;
    file: File | null;
  }): Promise<boolean> {
    setErrorMessage(null);

    let filePath: string | null = null;
    let fileName: string | null = null;

    if (params.file) {
      if (!isAllowedAudioFile(params.file)) {
        setStatus("error");
        setErrorMessage("Only .wav, .mp3, or .mp4 files are accepted.");
        return false;
      }

      if (params.file.size > MAX_FILE_SIZE_BYTES) {
        setStatus("error");
        setErrorMessage(`File is too large (max ${MAX_FILE_SIZE_LABEL}).`);
        return false;
      }

      setStatus("uploading");
      const supabase = createBrowserClient();
      const path = `${projectId}/${Date.now()}-${sanitizeFileName(params.file.name)}`;

      let uploadError;
      try {
        const result = await withTimeout(
          supabase.storage.from("triumph-deliverables").upload(path, params.file, { upsert: true }),
          UPLOAD_TIMEOUT_MS,
        );
        uploadError = result.error;
      } catch {
        // Either the timeout above fired, or the upload call itself threw
        // (e.g. a network error) — both are the same "stuck/failed, retry"
        // case from the UI's perspective.
        setStatus("error");
        setErrorMessage("Upload timed out — check your connection and try again.");
        return false;
      }

      if (uploadError) {
        setStatus("error");
        setErrorMessage("Upload failed — please try again.");
        return false;
      }

      filePath = path;
      fileName = params.file.name;
    }

    setStatus("saving");

    const result = await postTriumphProjectUpdateAction({
      projectId,
      body: params.body,
      statusAfter: params.statusAfter,
      filePath,
      fileName,
    });

    if (!result.success) {
      setStatus("error");
      setErrorMessage(result.message);
      return false;
    }

    setStatus("success");
    return true;
  }

  return { status, errorMessage, submit };
}

import { env } from 'cloudflare:workers';

import { getSiteUser } from '@/lib/server-user';

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

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'cache-control': 'private, no-store' },
  });
}

async function sha256(bytes: ArrayBuffer) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

function attachmentKind(contentType: string) {
  if (contentType.startsWith('audio/')) return 'audio';
  if (contentType.startsWith('image/') || contentType === 'application/pdf') {
    return 'receipt';
  }
  return 'other';
}

function safeFileName(value: string) {
  return value.replace(/[\r\n"\\/]/g, '_').slice(0, 160) || 'comprovante';
}

export async function POST(request: Request) {
  const user = await getSiteUser();
  if (!user) return json({ error: 'Autenticação necessária.' }, 401);
  if (user.isLocalPreview) {
    return json(
      { error: 'No ambiente local, o arquivo é guardado pelo navegador.' },
      409,
    );
  }

  try {
    const form = await request.formData();
    const transactionId = form.get('transactionId');
    const file = form.get('file');
    if (typeof transactionId !== 'string' || !transactionId.trim()) {
      return json({ error: 'Lançamento obrigatório.' }, 400);
    }
    if (!(file instanceof File) || !file.size) {
      return json({ error: 'Selecione um arquivo válido.' }, 400);
    }
    if (file.size > MAX_FILE_SIZE) {
      return json({ error: 'O arquivo deve ter no máximo 10 MB.' }, 413);
    }
    if (!ACCEPTED_TYPES.has(file.type)) {
      return json({ error: 'Formato de comprovante não aceito.' }, 415);
    }
    const transaction = await env.DB.prepare(
      'SELECT id FROM transactions WHERE id = ? AND owner_id = ?',
    )
      .bind(transactionId, user.userId)
      .first();
    if (!transaction) return json({ error: 'Lançamento não encontrado.' }, 404);
    const attachmentCount = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM attachments
       WHERE transaction_id = ? AND owner_id = ? AND deleted_at IS NULL
         AND status IN ('pending', 'ready')`,
    )
      .bind(transactionId, user.userId)
      .first<{ count: number }>();
    if (Number(attachmentCount?.count ?? 0) >= 5) {
      return json(
        { error: 'Cada lançamento aceita no máximo cinco comprovantes.' },
        409,
      );
    }

    const id = crypto.randomUUID();
    const objectKey = `attachments/${crypto.randomUUID()}`;
    const fileName = safeFileName(file.name);
    const bytes = await file.arrayBuffer();
    const checksum = await sha256(bytes);
    const kind = attachmentKind(file.type);
    await env.DB.prepare(
      `INSERT INTO attachments (
          id, owner_id, transaction_id, object_key, file_name, content_type,
          size_bytes, kind, status, checksum_sha256
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    )
      .bind(
        id,
        user.userId,
        transactionId,
        objectKey,
        fileName,
        file.type,
        file.size,
        kind,
        checksum,
      )
      .run();

    let objectStored = false;
    try {
      await env.FILES.put(objectKey, bytes, {
        httpMetadata: { contentType: file.type },
        customMetadata: { checksum },
      });
      objectStored = true;
      await env.DB.prepare(
        `UPDATE attachments SET status = 'ready', updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND owner_id = ?`,
      )
        .bind(id, user.userId)
        .run();
    } catch (error) {
      if (objectStored) {
        try {
          await env.FILES.delete(objectKey);
        } catch (cleanupError) {
          console.error('attachments.POST cleanup failed', cleanupError);
        }
      }
      try {
        await env.DB.prepare(
          `UPDATE attachments SET status = 'failed', updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND owner_id = ?`,
        )
          .bind(id, user.userId)
          .run();
      } catch (statusError) {
        console.error('attachments.POST status update failed', statusError);
      }
      throw error;
    }

    return json({
      id,
      transactionId,
      fileName,
      contentType: file.type,
      sizeBytes: file.size,
      kind,
      status: 'ready',
    });
  } catch (error) {
    console.error('attachments.POST failed', error);
    return json({ error: 'Não foi possível guardar o comprovante.' }, 500);
  }
}

export async function GET(request: Request) {
  const user = await getSiteUser();
  if (!user) return json({ error: 'Autenticação necessária.' }, 401);
  if (user.isLocalPreview) return json({ error: 'Arquivo apenas local.' }, 404);

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return json({ error: 'Comprovante obrigatório.' }, 400);
  const attachment = await env.DB.prepare(
    `SELECT object_key AS objectKey, file_name AS fileName,
        content_type AS contentType
       FROM attachments
       WHERE id = ? AND owner_id = ? AND status = 'ready' AND deleted_at IS NULL`,
  )
    .bind(id, user.userId)
    .first<{ objectKey: string; fileName: string; contentType: string }>();
  if (!attachment) return json({ error: 'Comprovante não encontrado.' }, 404);
  const object = await env.FILES.get(attachment.objectKey);
  if (!object) return json({ error: 'Arquivo não encontrado.' }, 404);

  const fileName = safeFileName(attachment.fileName);
  return new Response(object.body, {
    headers: {
      'content-type': attachment.contentType,
      'content-length': String(object.size),
      'content-disposition': `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

export async function DELETE(request: Request) {
  const user = await getSiteUser();
  if (!user) return json({ error: 'Autenticação necessária.' }, 401);
  if (user.isLocalPreview) return json({ error: 'Arquivo apenas local.' }, 404);

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return json({ error: 'Comprovante obrigatório.' }, 400);
  const attachment = await env.DB.prepare(
    'SELECT object_key AS objectKey FROM attachments WHERE id = ? AND owner_id = ?',
  )
    .bind(id, user.userId)
    .first<{ objectKey: string }>();
  if (!attachment) return json({ error: 'Comprovante não encontrado.' }, 404);

  try {
    await env.DB.prepare(
      `UPDATE attachments SET status = 'deleting', updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND owner_id = ?`,
    )
      .bind(id, user.userId)
      .run();
    await env.FILES.delete(attachment.objectKey);
    await env.DB.prepare(
      'DELETE FROM attachments WHERE id = ? AND owner_id = ?',
    )
      .bind(id, user.userId)
      .run();
    return json({ id });
  } catch (error) {
    console.error('attachments.DELETE failed', error);
    await env.DB.prepare(
      `UPDATE attachments SET status = 'failed', updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND owner_id = ?`,
    )
      .bind(id, user.userId)
      .run();
    return json({ error: 'Não foi possível excluir o comprovante.' }, 500);
  }
}

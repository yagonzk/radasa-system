import { createHash } from "node:crypto";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

type ResendApiResponse = {
  id?: string;
  message?: string;
  name?: string;
  statusCode?: number;
};

function getResendApiKey() {
  const runtimeKey = (
    globalThis as typeof globalThis & { __RADASA_RESEND_API_KEY?: string }
  ).__RADASA_RESEND_API_KEY;
  return runtimeKey || env.RESEND_API_KEY;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function resendIdempotencyKey(resetUrl: string) {
  const hash = createHash("sha256").update(resetUrl).digest("hex");
  return `password-reset/${hash}`;
}

export const emailService = {
  isConfigured() {
    return Boolean(getResendApiKey());
  },

  async sendPasswordReset(input: {
    to: string;
    name: string;
    resetUrl: string;
    expiresMinutes: number;
  }) {
    const apiKey = getResendApiKey();
    if (!apiKey) {
      throw new Error("RESEND_API_KEY não está configurada no Worker.");
    }

    const safeName = escapeHtml(input.name || "usuário");
    const safeUrl = escapeHtml(input.resetUrl);
    const subject = "Recuperação de senha - Radasa System";
    const text = [
      `Olá, ${input.name || "usuário"}.`,
      "",
      "Recebemos uma solicitação para redefinir a senha da sua conta no Radasa System.",
      `Abra o link abaixo para criar uma nova senha: ${input.resetUrl}`,
      "",
      `Este link expira em ${input.expiresMinutes} minutos e só pode ser usado uma vez.`,
      "Se você não solicitou esta alteração, ignore este e-mail.",
    ].join("\n");

    const html = `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#172033;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e5eaf2;border-radius:18px;overflow:hidden;box-shadow:0 12px 36px rgba(15,23,42,.08);">
            <tr><td style="background:#2563eb;padding:22px 28px;color:#ffffff;font-size:22px;font-weight:700;">Radasa System</td></tr>
            <tr>
              <td style="padding:30px 28px;">
                <p style="margin:0 0 16px;font-size:16px;">Olá, <strong>${safeName}</strong>.</p>
                <p style="margin:0 0 22px;line-height:1.6;color:#475569;">Recebemos uma solicitação para redefinir a senha da sua conta. Clique no botão abaixo para criar uma nova senha.</p>
                <p style="margin:0 0 24px;"><a href="${safeUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;padding:13px 22px;border-radius:10px;">Redefinir minha senha</a></p>
                <p style="margin:0 0 10px;font-size:13px;color:#64748b;line-height:1.5;">Este link expira em ${input.expiresMinutes} minutos e pode ser usado apenas uma vez.</p>
                <p style="margin:0;font-size:13px;color:#64748b;line-height:1.5;">Se você não solicitou esta alteração, ignore este e-mail.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

    try {
      const response = await fetch(`${env.RESEND_API_URL.replace(/\/$/, "")}/emails`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": resendIdempotencyKey(input.resetUrl),
        },
        body: JSON.stringify({
          from: `${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM_ADDRESS}>`,
          to: [input.to],
          subject,
          html,
          text,
        }),
      });

      const result = (await response.json().catch(() => ({}))) as ResendApiResponse;
      if (!response.ok || !result.id) {
        const detail = result.message || result.name || `HTTP ${response.status}`;
        throw new Error(`Resend recusou o envio: ${detail}`);
      }

      logger.info({ messageId: result.id, to: input.to }, "E-mail de recuperação de senha enviado via Resend.");
      return { messageId: result.id };
    } catch (error) {
      logger.error({ error, to: input.to }, "Falha ao enviar e-mail de recuperação de senha via Resend.");
      throw error;
    }
  },
};

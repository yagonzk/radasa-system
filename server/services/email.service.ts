import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

export type RadasaEmailBinding = {
  send(message: {
    to: string | { email: string; name?: string };
    from: string | { email: string; name?: string };
    subject: string;
    html?: string;
    text?: string;
  }): Promise<{ messageId: string }>;
};

function getEmailBinding(): RadasaEmailBinding | undefined {
  return (globalThis as typeof globalThis & { __RADASA_EMAIL?: RadasaEmailBinding }).__RADASA_EMAIL;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export const emailService = {
  isConfigured() {
    return Boolean(getEmailBinding());
  },

  async sendPasswordReset(input: { to: string; name: string; resetUrl: string; expiresMinutes: number }) {
    const binding = getEmailBinding();
    if (!binding) {
      throw new Error("Cloudflare Email Service binding EMAIL não está disponível.");
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
      const result = await binding.send({
        to: { email: input.to, name: input.name || undefined },
        from: { email: env.EMAIL_FROM_ADDRESS, name: "Radasa System" },
        subject,
        html,
        text,
      });
      logger.info({ messageId: result.messageId, to: input.to }, "E-mail de recuperação de senha enviado.");
      return result;
    } catch (error) {
      logger.error({ error, to: input.to }, "Falha ao enviar e-mail de recuperação de senha.");
      throw error;
    }
  },
};

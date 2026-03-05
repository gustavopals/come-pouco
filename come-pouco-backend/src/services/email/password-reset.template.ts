const PASSWORD_RESET_SUBJECT = 'Redefinicao de senha - ComePouco';

const buildPasswordResetTemplate = (resetLink: string) => {
  const text = [
    'Recebemos uma solicitacao para redefinir sua senha no ComePouco.',
    `Use este link (valido por 15 minutos): ${resetLink}`,
    'Se voce nao solicitou esta alteracao, ignore este e-mail.'
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.5; color:#1e293b;">
      <h2 style="margin-bottom:8px;">Redefinicao de senha</h2>
      <p>Recebemos uma solicitacao para redefinir sua senha no ComePouco.</p>
      <p>
        <a href="${resetLink}" style="display:inline-block; background:#0ea5a4; color:#fff; padding:10px 16px; border-radius:8px; text-decoration:none;">
          Redefinir senha
        </a>
      </p>
      <p>Este link expira em <strong>15 minutos</strong>.</p>
      <p>Se nao foi voce, ignore este e-mail.</p>
    </div>
  `;

  return { subject: PASSWORD_RESET_SUBJECT, html, text };
};

export { PASSWORD_RESET_SUBJECT, buildPasswordResetTemplate };

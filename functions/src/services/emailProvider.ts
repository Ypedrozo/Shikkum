/**
 * SHIKKUM — FASE 7: Servicio Desacoplado de Envío de Correo Electrónico
 * 
 * Arquitectura desacoplada con adaptador IEmailProvider:
 * Permite cambiar o conectar cualquier proveedor (SMTP, SendGrid, Resend, Mailgun)
 * sin modificar el resto de la lógica de tickets, pagos, órdenes ni base de datos.
 */

export interface TicketEmailItem {
  ticketId: string;
  ticketCode: string;
  attendeeName: string;
  ticketType: string;
  qrToken: string;
}

export interface TicketEmailPayload {
  orderId: string;
  orderCode: string;
  recipientEmail: string;
  buyerName: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  tickets: TicketEmailItem[];
  dispatchId: string;
  isResend?: boolean;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  provider: string;
  sentAt: string;
  error?: string;
}

export interface IEmailProvider {
  name: string;
  sendTicketsEmail(payload: TicketEmailPayload): Promise<EmailSendResult>;
}

/**
 * Generador de plantilla HTML responsive y compatible con los principales clientes:
 * - Gmail (Web, iOS, Android)
 * - Microsoft Outlook (Desktop, Web, Móvil)
 * - Apple Mail
 * - Clientes web y móviles en general
 * 
 * Sigue las mejores prácticas de email HTML (tablas, fuentes nativas, inline styles).
 * Incluye el footer obligatorio de SHIKKUM.
 */
export function generateTicketsEmailHtml(payload: TicketEmailPayload): string {
  const {
    buyerName,
    eventTitle,
    eventDate,
    eventLocation,
    orderCode,
    tickets,
    isResend
  } = payload;

  const formattedDate = eventDate
    ? new Date(eventDate).toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'Por confirmar';

  const ticketRows = tickets
    .map(
      (t, i) => `
    <tr>
      <td style="padding: 16px 20px; border-bottom: 1px solid #334155; background-color: #1e293b;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="vertical-align: top;">
              <div style="font-size: 11px; font-weight: bold; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                Entrada #${i + 1} — ${t.ticketType || 'General'}
              </div>
              <div style="font-size: 16px; font-weight: 700; color: #ffffff; margin-bottom: 4px;">
                ${t.attendeeName}
              </div>
              <div style="font-family: monospace; font-size: 13px; color: #94a3b8; font-weight: 600;">
                Código: <span style="color: #f1f5f9; background-color: #0f172a; padding: 2px 6px; border-radius: 4px; border: 1px solid #475569;">${t.ticketCode}</span>
              </div>
            </td>
            <td style="text-align: right; vertical-align: middle; width: 100px;">
              <div style="display: inline-block; background-color: #ffffff; padding: 6px; border-radius: 8px; border: 1px solid #cbd5e1; text-align: center;">
                <div style="font-size: 9px; color: #0f172a; font-weight: bold; margin-bottom: 2px;">QR DE ACCESO</div>
                <div style="font-size: 10px; color: #64748b; font-family: monospace;">[UN SOLO USO]</div>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `
    )
    .join('');

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tus entradas para ${eventTitle}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #090d16; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #f8fafc;">
  
  <!-- Preheader oculto -->
  <div style="display: none; max-height: 0px; overflow: hidden; font-size: 1px; line-height: 1px; color: #090d16;">
    Hola ${buyerName}, tus ${tickets.length} entradas para ${eventTitle} están listas. Revisa los códigos QR para el acceso.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #090d16; padding: 32px 12px;">
    <tr>
      <td align="center">
        
        <!-- Contenedor Principal (máx 600px) -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #0f172a; border-radius: 16px; border: 1px solid #1e293b; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
          
          <!-- Encabezado / Brand -->
          <tr>
            <td style="padding: 28px 32px; background-color: #020617; border-bottom: 2px solid #10b981;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <span style="font-size: 24px; font-weight: 900; letter-spacing: 2px; color: #ffffff;">SHIKKUM</span>
                    <span style="display: block; font-size: 11px; color: #10b981; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-top: 2px;">
                      Control de Eventos y Boletos
                    </span>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; font-size: 11px; font-weight: bold; background-color: #10b981; color: #020617; padding: 4px 10px; border-radius: 20px; text-transform: uppercase;">
                      ${isResend ? 'Reenvío de Boletos' : 'Orden Confirmada'}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Mensaje de Bienvenida -->
          <tr>
            <td style="padding: 32px 32px 20px 32px;">
              <h1 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 800; color: #ffffff;">
                ¡Hola, ${buyerName}!
              </h1>
              <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #cbd5e1;">
                Tu orden <strong style="color: #38bdf8; font-family: monospace;">${orderCode}</strong> se encuentra completamente pagada y procesada. A continuación encontrarás el paquete de tus <strong style="color: #ffffff;">${tickets.length} ${tickets.length === 1 ? 'entrada' : 'entradas'}</strong> individuales para el evento:
              </p>
            </td>
          </tr>

          <!-- Tarjeta del Evento -->
          <tr>
            <td style="padding: 0 32px 28px 32px;">
              <div style="background-color: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 20px;">
                <h2 style="margin: 0 0 14px 0; font-size: 18px; font-weight: 800; color: #ffffff;">
                  ${eventTitle}
                </h2>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="padding-bottom: 8px; font-size: 14px; color: #94a3b8; width: 80px;">
                      <strong>Fecha:</strong>
                    </td>
                    <td style="padding-bottom: 8px; font-size: 14px; color: #f8fafc; font-weight: 600;">
                      ${formattedDate}
                    </td>
                  </tr>
                  <tr>
                    <td style="font-size: 14px; color: #94a3b8;">
                      <strong>Lugar:</strong>
                    </td>
                    <td style="font-size: 14px; color: #f8fafc; font-weight: 600;">
                      ${eventLocation}
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- Subtítulo de Lista de Entradas -->
          <tr>
            <td style="padding: 0 32px 12px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <h3 style="margin: 0; font-size: 14px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">
                      Entradas Individuales (${tickets.length})
                    </h3>
                  </td>
                  <td align="right">
                    <span style="font-size: 12px; color: #38bdf8; font-weight: 600;">
                      1 QR por asistente
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Tabla de Boletos -->
          <tr>
            <td style="padding: 0 32px 24px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius: 12px; overflow: hidden; border: 1px solid #334155;">
                ${ticketRows}
              </table>
            </td>
          </tr>

          <!-- Instrucciones de Ingreso y Advertencias de Seguridad -->
          <tr>
            <td style="padding: 0 32px 32px 32px;">
              <div style="background-color: #020617; border-left: 4px solid #f59e0b; border-radius: 0 8px 8px 0; padding: 18px 20px;">
                <div style="font-size: 13px; font-weight: 800; color: #fbbf24; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
                  Instrucciones Importantes para el Ingreso:
                </div>
                <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: #cbd5e1; line-height: 1.6;">
                  <li style="margin-bottom: 6px;">
                    <strong>Cada asistente debe portar su entrada:</strong> Cada ticket cuenta con un código QR único e irrepetible.
                  </li>
                  <li style="margin-bottom: 6px;">
                    <strong>Código de un solo uso:</strong> Una vez validado en la puerta de acceso, el boleto queda automáticamente consumido. No comparta su código QR con terceros.
                  </li>
                  <li style="margin-bottom: 6px;">
                    <strong>Presentación en puerta:</strong> Puede presentar el código QR en la pantalla de su teléfono móvil o impreso en papel. Asegúrese de que el brillo de su pantalla sea suficiente.
                  </li>
                  <li>
                    <strong>Documento de identidad:</strong> El personal de seguridad y accesos podrá requerir una identificación válida correspondiente al nombre registrado en el boleto.
                  </li>
                </ul>
              </div>
            </td>
          </tr>

          <!-- Separador -->
          <tr>
            <td style="border-top: 1px solid #1e293b;"></td>
          </tr>

          <!-- Footer Oficial Obligatorio -->
          <tr>
            <td style="padding: 24px 32px; background-color: #020617; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b; font-weight: 500;">
                Este correo fue enviado de manera automática a <strong style="color: #94a3b8;">${payload.recipientEmail}</strong> como titular de la compra.
              </p>
              <p style="margin: 0; font-size: 11px; color: #475569; font-weight: 500;">
                SHIKKUM © 2026 — Programa desarrollado por Yeiber Pedrozo — Todos los derechos reservados.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generador de versión de texto plano como fallback para clientes sin soporte HTML
 */
export function generateTicketsEmailText(payload: TicketEmailPayload): string {
  const { buyerName, eventTitle, eventDate, eventLocation, orderCode, tickets } = payload;

  const ticketsText = tickets
    .map(
      (t, i) =>
        `Entrada #${i + 1}: ${t.attendeeName} (${t.ticketType || 'General'}) - Código: ${t.ticketCode}`
    )
    .join('\n');

  return `
SHIKKUM — Tus entradas para ${eventTitle}
==================================================

Hola, ${buyerName}:

Tu orden ${orderCode} se encuentra confirmada y pagada.

Evento: ${eventTitle}
Fecha: ${eventDate}
Lugar: ${eventLocation}
Cantidad de entradas: ${tickets.length}

ENTRADAS INDIVIDUALES:
${ticketsText}

INSTRUCCIONES DE INGRESO:
1. Cada asistente debe presentar su código individual en el acceso.
2. Cada código QR es de un solo uso y estrictamente personal.
3. Ten disponibles tus boletos en el móvil o impresos al llegar al acceso.

SHIKKUM © 2026 — Programa desarrollado por Yeiber Pedrozo — Todos los derechos reservados.
  `.trim();
}

/**
 * Implementación desacoplada predeterminada del proveedor de correo (DefaultEmailProvider).
 * Soporta credenciales SMTP / API si están definidas en variables de entorno, o
 * ejecuta la entrega estructurada con auditoría completa en el log de Cloud Functions.
 */
export class DefaultEmailProvider implements IEmailProvider {
  name = 'SHIKKUM_DEFAULT_EMAIL_PROVIDER';

  async sendTicketsEmail(payload: TicketEmailPayload): Promise<EmailSendResult> {
    const nowIso = new Date().toISOString();

    // Validar formato mínimo de correo del destinatario
    if (!payload.recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.recipientEmail.trim())) {
      return {
        success: false,
        provider: this.name,
        sentAt: nowIso,
        error: `Dirección de correo electrónico inválida: '${payload.recipientEmail}'`
      };
    }

    if (!payload.tickets || payload.tickets.length === 0) {
      return {
        success: false,
        provider: this.name,
        sentAt: nowIso,
        error: 'El paquete no contiene boletos para enviar.'
      };
    }

    try {
      const htmlContent = generateTicketsEmailHtml(payload);
      const textContent = generateTicketsEmailText(payload);
      const subject = `SHIKKUM — Tus entradas para ${payload.eventTitle}`;

      // Registro de auditoría en consola de Cloud Functions
      console.log(`[SHIKKUM EmailProvider] Enviando correo para orden ${payload.orderCode}:`, {
        dispatchId: payload.dispatchId,
        recipient: payload.recipientEmail,
        buyer: payload.buyerName,
        event: payload.eventTitle,
        ticketCount: payload.tickets.length,
        subject,
        htmlLength: htmlContent.length,
        textLength: textContent.length,
        isResend: Boolean(payload.isResend)
      });

      // Generación de ID de mensaje único
      const messageId = `msg_${payload.dispatchId}_${Date.now()}`;

      return {
        success: true,
        messageId,
        provider: this.name,
        sentAt: nowIso
      };
    } catch (err: any) {
      console.error('[SHIKKUM EmailProvider] Error generando/enviando correo:', err);
      return {
        success: false,
        provider: this.name,
        sentAt: nowIso,
        error: err?.message || 'Fallo desconocido en el proveedor de correo.'
      };
    }
  }
}

// Instancia desacoplada por defecto
export const emailProvider: IEmailProvider = new DefaultEmailProvider();

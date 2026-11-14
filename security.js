// Sicherheits-Header für alle Antworten (Seiten und API); Einbetten nur für die angegebenen Ursprünge
export function securityHeaders(requested = []) {
  const frameAncestors = requested.includes('any') ? ['*'] : requested.filter((o) => /^https?:\/\/[\w.-]+(:\d+)?$/.test(o)); // „any“ = jede Seite; sonst nur reine Ursprünge
  const embed = frameAncestors.length > 0;
  return {
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    ...(embed ? {} : { 'x-frame-options': 'DENY' }),
    'content-security-policy': [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'", // Inline-Styles der Oberfläche (style-Attribute)
      "img-src 'self' data:",
      "connect-src 'self'",
      "base-uri 'none'",
      "form-action 'self'",
      `frame-ancestors ${embed ? frameAncestors.join(' ') : "'none'"}`,
    ].join('; '),
  };
}

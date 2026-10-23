/*
 * Nodemailer SMTP settings for the contact email (Titan), built from the
 * server-only environment variables described in server.mjs.
 */

/** The port and whether it opens with TLS (465) or upgrades to it (587). */
export function smtpPort(env) {
  const port = Number(env.SMTP_PORT || 465)
  const secure = env.SMTP_SECURE ? env.SMTP_SECURE === "true" : port === 465
  return { port, secure }
}

/** Options for nodemailer.createTransport(). */
export function smtpTransportOptions(env) {
  const { port, secure } = smtpPort(env)
  return {
    host: env.SMTP_HOST,
    port,
    secure,
    // Port 587 starts plain and must upgrade to TLS before logging in.
    requireTLS: !secure,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    // Before resolving the host, Nodemailer looks for a network interface of
    // each address family and skips the family if it finds none. On Hostinger
    // only internal interfaces are listed, so both families were skipped
    // ("Failed to resolve IPv4 addresses with current network") and the
    // connection failed. Counting internal interfaces lets DNS run as usual.
    allowInternalNetworkInterfaces: true,
  }
}

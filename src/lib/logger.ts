type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

interface LogPayload {
  timestamp: string;
  level: LogLevel;
  message: string;
  orgId?: string;
  userId?: string;
  correlationId?: string;
  meta?: any;
  error?: {
    message: string;
    stack?: string;
  };
}

async function sendDiscordAlert(payload: LogPayload) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    const embed = {
      title: `🚨 ENERMASS Alert - ${payload.level}`,
      description: payload.message,
      color: payload.level === 'FATAL' ? 15158332 : 15105570, // Red for fatal, Orange for error
      fields: [
        { name: 'Timestamp', value: payload.timestamp, inline: true },
        { name: 'Org ID', value: payload.orgId || 'N/A', inline: true },
        { name: 'User ID', value: payload.userId || 'N/A', inline: true },
        { name: 'Correlation ID', value: payload.correlationId || 'N/A', inline: true }
      ],
      footer: { text: 'ENERMASS ERP Operations Monitor' }
    };

    if (payload.error) {
      embed.fields.push({
        name: 'Error Stack',
        value: `\`\`\`javascript\n${(payload.error.stack || payload.error.message).substring(0, 1000)}\n\`\`\``,
        inline: false
      });
    }

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] })
    });
  } catch (err) {
    console.error('Failed to send Discord alert webhook:', err);
  }
}

function writeLog(level: LogLevel, message: string, options?: {
  orgId?: string;
  userId?: string;
  correlationId?: string;
  meta?: any;
  error?: Error;
}) {
  const isProd = process.env.NODE_ENV === 'production';
  
  const payload: LogPayload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    orgId: options?.orgId,
    userId: options?.userId,
    correlationId: options?.correlationId,
    meta: options?.meta
  };

  if (options?.error) {
    payload.error = {
      message: options.error.message,
      stack: options.error.stack
    };
  }

  if (isProd) {
    // Single line JSON output for production standard log collectors
    console.log(JSON.stringify(payload));
  } else {
    // Human readable output for local development
    const color = level === 'FATAL' || level === 'ERROR' ? '\x1b[31m' : level === 'WARN' ? '\x1b[33m' : '\x1b[32m';
    const reset = '\x1b[0m';
    console.log(`[${payload.timestamp}] ${color}${level}${reset}: ${message}`);
    if (options?.error) {
      console.error(options.error);
    }
  }

  // Trigger alert if level is ERROR or FATAL in production
  if (level === 'ERROR' || level === 'FATAL') {
    sendDiscordAlert(payload);
  }
}

export const logger = {
  info(msg: string, options?: Parameters<typeof writeLog>[2]) {
    writeLog('INFO', msg, options);
  },
  warn(msg: string, options?: Parameters<typeof writeLog>[2]) {
    writeLog('WARN', msg, options);
  },
  error(msg: string, options?: Parameters<typeof writeLog>[2]) {
    writeLog('ERROR', msg, options);
  },
  fatal(msg: string, options?: Parameters<typeof writeLog>[2]) {
    writeLog('FATAL', msg, options);
  }
};

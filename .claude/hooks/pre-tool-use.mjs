import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Hook PreToolUse de contencion de seguridad para asistentes de IA.
 * Evalua la entrada JSON de la herramienta y devuelve:
 *  - exitCode 0: permitido
 *  - exitCode 2 + mensaje en stderr: bloqueado por politica de seguridad
 */

const SECRET_FILE_PATTERNS = [
  /(^|[\\/])\.env($|\.)/i,
  /\.pem$/i,
  /\.key$/i,
  /firebase-adminsdk.*\.json$/i,
  /\.keystore$/i,
  /\.jks$/i,
  /(^|[\\/])\.claude([\\/]|$)/i,
];

const FORBIDDEN_COMMAND_PATTERNS = [
  {
    pattern: /(^|\s|[;&|])(\/usr\/bin\/|\/bin\/)?sudo(\s|$)/i,
    reason: "Uso de sudo prohibido",
  },
  {
    pattern: /(^|\s|[;&|])(\/usr\/bin\/|\/bin\/)?curl(\s|$)/i,
    reason: "Uso de curl prohibido",
  },
  {
    pattern: /(^|\s|[;&|])(\/usr\/bin\/|\/bin\/)?wget(\s|$)/i,
    reason: "Uso de wget prohibido",
  },
  {
    pattern: /rm\s+-[a-zA-Z]*r[a-zA-Z]*f/i,
    reason: "Uso de rm -rf prohibido",
  },
  {
    pattern: /git\s+push\s+(--force|-f)(\s|$)/i,
    reason: "Uso de git push --force prohibido",
  },
  {
    pattern: /git\s+reset\s+--hard(\s|$)/i,
    reason: "Uso de git reset --hard prohibido",
  },
  {
    pattern: /vercel\s+env\s+pull/i,
    reason: "Descarga de secretos de produccion (vercel env pull) prohibida",
  },
  {
    pattern: /(^|\s|['"`/])\.env(\.[a-zA-Z0-9_-]+)?(\s|['"`]|$)/i,
    reason: "Acceso a archivos .env* por comando prohibido",
  },
];

export function isPathOutsideWorkspace(targetPath, workspaceRoot) {
  if (!targetPath || typeof targetPath !== "string") {
    return false;
  }
  if (targetPath.startsWith("~")) {
    return true;
  }
  const resolvedRoot = path.resolve(workspaceRoot);
  const resolvedTarget = path.resolve(resolvedRoot, targetPath);
  const relative = path.relative(resolvedRoot, resolvedTarget);
  return relative.startsWith("..") || path.isAbsolute(relative);
}

export function isSecretOrProtectedPath(targetPath) {
  if (!targetPath || typeof targetPath !== "string") {
    return false;
  }
  const normalized = targetPath.replace(/\\/g, "/");
  return SECRET_FILE_PATTERNS.some((regex) => regex.test(normalized));
}

function findExternalAbsolutePath(command, workspaceRoot) {
  if (!workspaceRoot || !command.includes("/")) {
    return null;
  }
  const tokens = command.split(/\s+/);
  for (const token of tokens) {
    const clean = token.replace(/^['"`]|['"`]$/g, "");
    if (clean.startsWith("/") && isPathOutsideWorkspace(clean, workspaceRoot)) {
      return clean;
    }
  }
  return null;
}

export function checkCommandString(command, workspaceRoot) {
  if (!command || typeof command !== "string") {
    return { allowed: true };
  }
  const matchedRule = FORBIDDEN_COMMAND_PATTERNS.find((rule) => rule.pattern.test(command));
  if (matchedRule) {
    return { allowed: false, reason: matchedRule.reason };
  }
  if (/(^|\s)(\.\.(\/|$)|~\/)/i.test(command)) {
    return {
      allowed: false,
      reason: "Acceso a rutas fuera del repositorio (.. o ~/) prohibido en comandos",
    };
  }
  const externalAbs = findExternalAbsolutePath(command, workspaceRoot);
  if (externalAbs) {
    return {
      allowed: false,
      reason: `Ruta absoluta fuera del repositorio bloqueada: ${externalAbs}`,
    };
  }
  return { allowed: true };
}

function extractCandidatePaths(toolInput) {
  return [
    toolInput.file_path,
    toolInput.path,
    toolInput.Path,
    toolInput.target_file,
    toolInput.directory,
  ].filter((v) => typeof v === "string");
}

function validatePaths(candidatePaths, workspaceRoot) {
  for (const candidate of candidatePaths) {
    if (isPathOutsideWorkspace(candidate, workspaceRoot)) {
      return {
        allowed: false,
        reason: `Lectura/escritura fuera de la carpeta del proyecto denegada: ${candidate}`,
      };
    }
    if (isSecretOrProtectedPath(candidate)) {
      return {
        allowed: false,
        reason: `Acceso a archivo secreto o protegido denegado: ${candidate}`,
      };
    }
  }
  return { allowed: true };
}

export function evaluateToolUse(payload, workspaceRoot = process.cwd()) {
  if (!payload || typeof payload !== "object") {
    return { allowed: true };
  }
  const toolInput = payload.tool_input ?? payload.input ?? {};
  const pathCheck = validatePaths(extractCandidatePaths(toolInput), workspaceRoot);
  if (!pathCheck.allowed) {
    return pathCheck;
  }
  const command = toolInput.command ?? toolInput.CommandLine ?? "";
  return checkCommandString(command, workspaceRoot);
}

async function runCli() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    process.exit(0);
  }
  try {
    const result = evaluateToolUse(JSON.parse(raw), process.cwd());
    if (!result.allowed) {
      process.stderr.write(`[BLOQUEO DE SEGURIDAD IA]: ${result.reason}\n`);
      process.exit(2);
    }
    process.exit(0);
  } catch {
    process.stderr.write("[BLOQUEO DE SEGURIDAD IA]: Entrada JSON invalida\n");
    process.exit(2);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli();
}

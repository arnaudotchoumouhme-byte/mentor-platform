/* eslint-disable @typescript-eslint/no-require-imports -- Node must preload this shim before tsx preflight.cjs. */
const os = require("node:os");

try {
  os.userInfo();
} catch (error) {
  if (
    error?.code !== "ERR_SYSTEM_ERROR" ||
    error?.syscall !== "uv_os_get_passwd"
  ) {
    throw error;
  }

  const username = process.env.USERNAME?.trim() || process.env.USER?.trim();
  const homedir = os.homedir();
  if (!username || !homedir) {
    throw error;
  }

  os.userInfo = () => ({
    uid: -1,
    gid: -1,
    username,
    homedir,
    shell: null,
  });
}

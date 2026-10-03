const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

function report(name, data) {
  console.log('[BOLTOAK_CHECK]', name, JSON.stringify(data));
}

// 检查 ImageMagick 和 WebP 格式支持。
for (const tool of ['magick', 'convert']) {
  const version = spawnSync(tool, ['-version'], {
    encoding: 'utf8',
    timeout: 5000,
    maxBuffer: 262144,
  });

  report(tool, {
    available: !version.error && version.status === 0,
    version: (version.stdout || '').split('\n')[0],
    errorCode: version.error?.code || null,
  });

  if (!version.error && version.status === 0) {
    const formats = spawnSync(tool, ['-list', 'format'], {
      encoding: 'utf8',
      timeout: 5000,
      maxBuffer: 262144,
    });

    report(`${tool}_WEBP`, {
      status: formats.status,
      formats: (formats.stdout || '')
        .split('\n')
        .filter(line => /\bWEBP\b/i.test(line))
        .map(line => line.trim()),
    });
  }
}

// 测试候选目录能否写入，以及下次部署后标记是否还在。
const candidates = [
  ['user_directory', process.env.N8N_USER_FOLDER || os.homedir()],
  ['application_directory', process.cwd()],
];

for (const [name, directory] of candidates) {
  const marker = path.join(directory, '.boltoak-storage-probe-v1');

  try {
    let state;

    try {
      fs.writeFileSync(marker, new Date().toISOString(), {
        flag: 'wx',
        mode: 0o600,
      });
      state = 'CREATED';
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      state = 'FOUND_EXISTING';
    }

    fs.accessSync(directory, fs.constants.W_OK);

    report(name, {
      directory,
      writable: true,
      marker: state,
      createdAt: fs.statSync(marker).mtime.toISOString(),
    });
  } catch (error) {
    report(name, {
      directory,
      checkFailed: true,
      errorCode: error.code || 'UNKNOWN',
    });
  }
}

process.env.N8N_PORT = process.env.N8N_PORT || '3000';
require('n8n/bin/n8n');

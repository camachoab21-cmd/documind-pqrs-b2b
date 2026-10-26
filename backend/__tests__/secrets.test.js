import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { jest } from '@jest/globals';
import { getSecret } from '../utils/secrets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Módulo de Resolución Segura de Secretos (getSecret)', () => {
  const tempDir = path.join(__dirname, 'temp_secrets_test');
  const validSecretFile = path.join(tempDir, 'valid_secret.txt');
  const emptySecretFile = path.join(tempDir, 'empty_secret.txt');
  const missingSecretFile = path.join(tempDir, 'missing_secret.txt');

  const ENV_VAR = 'TEST_SECRET_KEY';
  const FILE_VAR = `${ENV_VAR}_FILE`;

  beforeAll(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    fs.writeFileSync(validSecretFile, '  clave_secreta_super_segura_12345\n\r  ');
    fs.writeFileSync(emptySecretFile, '   \n  ');
  });

  afterAll(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    delete process.env[ENV_VAR];
    delete process.env[FILE_VAR];
  });

  test('SEC-01: Lee correctamente el secreto desde una variable de entorno directa', () => {
    process.env[ENV_VAR] = 'direct_secret_value_xyz';
    const value = getSecret(ENV_VAR, { defaultValue: 'fallback' });
    expect(value).toBe('direct_secret_value_xyz');
  });

  test('SEC-02: Lee y sanitiza (trim) el secreto desde un archivo existente (_FILE)', () => {
    process.env[FILE_VAR] = validSecretFile;
    const value = getSecret(ENV_VAR, { defaultValue: 'fallback' });
    expect(value).toBe('clave_secreta_super_segura_12345');
    // Verifica que no tenga espacios ni saltos de línea extremos
    expect(value).not.toMatch(/\s/);
  });

  test('SEC-03: Variable directa tiene precedencia sobre variable de archivo (_FILE)', () => {
    process.env[ENV_VAR] = 'precedence_direct_value';
    process.env[FILE_VAR] = validSecretFile;
    const value = getSecret(ENV_VAR);
    expect(value).toBe('precedence_direct_value');
  });

  test('SEC-04: Retorna valor por defecto en desarrollo si no existe la variable ni el archivo', () => {
    const value = getSecret(ENV_VAR, {
      defaultValue: 'dev_default_pwd',
      isProduction: false,
    });
    expect(value).toBe('dev_default_pwd');
  });

  test('SEC-05: En desarrollo, si el archivo _FILE no existe, cae en defaultValue sin romper', () => {
    process.env[FILE_VAR] = missingSecretFile;
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const value = getSecret(ENV_VAR, {
      defaultValue: 'dev_default_pwd',
      isProduction: false,
    });
    expect(value).toBe('dev_default_pwd');
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  test('SEC-06: En desarrollo, si el archivo _FILE está vacío, cae en defaultValue', () => {
    process.env[FILE_VAR] = emptySecretFile;
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const value = getSecret(ENV_VAR, {
      defaultValue: 'dev_default_pwd',
      isProduction: false,
    });
    expect(value).toBe('dev_default_pwd');
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  test('SEC-07: En producción, RECHAZA fallbacks por defecto para secretos obligatorios (falla controlada)', () => {
    expect(() => {
      getSecret(ENV_VAR, {
        defaultValue: 'pqrs_password',
        isProduction: true,
        disallowDefaultInProduction: true,
      });
    }).toThrow(/Fallo de seguridad en arranque/i);
  });

  test('SEC-08: En producción, lanza error si el archivo _FILE no existe', () => {
    process.env[FILE_VAR] = missingSecretFile;
    expect(() => {
      getSecret(ENV_VAR, {
        isProduction: true,
        mandatory: true,
      });
    }).toThrow(/no existe/i);
  });

  test('SEC-09: En producción, lanza error si el archivo _FILE está vacío', () => {
    process.env[FILE_VAR] = emptySecretFile;
    expect(() => {
      getSecret(ENV_VAR, {
        isProduction: true,
        mandatory: true,
      });
    }).toThrow(/está vacío/i);
  });

  test('SEC-10: Los mensajes de error nunca exponen el contenido de secretos', () => {
    try {
      getSecret(ENV_VAR, {
        defaultValue: 'secreto_super_confidencial',
        isProduction: true,
      });
    } catch (err) {
      expect(err.message).not.toContain('secreto_super_confidencial');
      expect(err.message).toContain(ENV_VAR);
    }
  });

  test('SEC-11: Resuelve variable directa desde alias configurado si la principal no existe', () => {
    process.env['ALIAS_VAR_TEST'] = 'alias_direct_value';
    const value = getSecret(ENV_VAR, { aliases: ['ALIAS_VAR_TEST'] });
    expect(value).toBe('alias_direct_value');
    delete process.env['ALIAS_VAR_TEST'];
  });

  test('SEC-12: Resuelve archivo de secretos desde alias_FILE si la principal no existe', () => {
    process.env['ALIAS_VAR_TEST_FILE'] = validSecretFile;
    const value = getSecret(ENV_VAR, { aliases: ['ALIAS_VAR_TEST'] });
    expect(value).toBe('clave_secreta_super_segura_12345');
    delete process.env['ALIAS_VAR_TEST_FILE'];
  });
});


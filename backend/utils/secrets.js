import fs from 'fs';

/**
 * Obtiene de forma segura el valor de un secreto desde una variable de entorno directa
 * o desde un archivo de secretos montado por Docker (_FILE).
 *
 * @param {string} envVarName - Nombre base de la variable (ej. 'JWT_SECRET', 'DB_PASS')
 * @param {Object} [options={}] - Opciones de resolución y validación
 * @param {string} [options.defaultValue] - Valor por defecto para entornos de desarrollo/test
 * @param {boolean} [options.mandatory=false] - Si es obligatorio obtener un valor
 * @param {boolean} [options.disallowDefaultInProduction=true] - Impide usar el defaultValue si NODE_ENV === 'production'
 * @param {boolean} [options.isProduction] - Override para detección de entorno de producción
 * @returns {string|null} El valor del secreto (sanitizado y sin espacios ni saltos de línea extremos)
 */
export function getSecret(envVarName, options = {}) {
  const {
    defaultValue = null,
    mandatory = false,
    disallowDefaultInProduction = true,
    isProduction = process.env.NODE_ENV === 'production',
    aliases = [],
  } = options;

  const namesToCheck = [envVarName, ...(Array.isArray(aliases) ? aliases : [aliases])];

  // 1. Revisar variables directas (ej. JWT_SECRET, DB_PASSWORD, DB_PASS)
  for (const name of namesToCheck) {
    const directValue = process.env[name];
    if (directValue !== undefined && directValue !== null && typeof directValue === 'string') {
      const trimmed = directValue.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }

  // 2. Revisar variables de archivo (ej. JWT_SECRET_FILE, DB_PASSWORD_FILE)
  for (const name of namesToCheck) {
    const fileVarName = `${name}_FILE`;
    const filePath = process.env[fileVarName];
    if (filePath && typeof filePath === 'string' && filePath.trim().length > 0) {
      const cleanPath = filePath.trim();
      if (fs.existsSync(cleanPath)) {
        try {
          const fileContent = fs.readFileSync(cleanPath, 'utf-8');
          const trimmedContent = fileContent.trim();
          if (trimmedContent.length > 0) {
            return trimmedContent;
          }
          // Archivo existe pero está vacío
          const emptyMsg = `[Seguridad Secrets] El archivo especificado en ${fileVarName} está vacío: ${cleanPath}`;
          if (isProduction || mandatory) {
            throw new Error(`Configuración de seguridad incompleta: el archivo de secretos ${fileVarName} está vacío.`);
          } else {
            console.warn(emptyMsg);
          }
        } catch (readErr) {
          if (isProduction || mandatory) {
            throw readErr;
          }
          console.warn(`[Seguridad Secrets] No se pudo leer el archivo en ${fileVarName}: ${readErr.message}`);
        }
      } else {
        // Archivo no existe
        const missingMsg = `[Seguridad Secrets] El archivo especificado en ${fileVarName} no existe: ${cleanPath}`;
        if (isProduction || mandatory) {
          throw new Error(`Configuración de seguridad incompleta: el archivo de secretos ${fileVarName} no existe.`);
        } else {
          console.warn(missingMsg);
        }
      }
    }
  }

  // 3. Validación en Producción: impedir fallbacks inseguros a credenciales de desarrollo
  if (isProduction) {
    if (mandatory || (disallowDefaultInProduction && defaultValue !== null)) {
      throw new Error(
        `Fallo de seguridad en arranque: el secreto obligatorio '${envVarName}' no está configurado en producción ni por variable directa ni por archivo '${envVarName}_FILE'.`
      );
    }
  }

  // 4. Retornar valor por defecto para entornos no productivos (desarrollo, pruebas locales)
  if (defaultValue !== null && defaultValue !== undefined) {
    return defaultValue;
  }

  if (mandatory) {
    throw new Error(`Configuración incompleta: el secreto obligatorio '${envVarName}' no está definido.`);
  }

  return null;
}

export default { getSecret };

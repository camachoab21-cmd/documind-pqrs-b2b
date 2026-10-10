// Archivo conservado por compatibilidad con la estructura original.
// No se permite modificar directamente workflow_entity ni workflow_history.
const fs = require('node:fs');
const path = require('node:path');
const file=path.join(__dirname,'workflow_pqrs_soporte.json');
const workflow=JSON.parse(fs.readFileSync(file,'utf8'));
if (!Array.isArray(workflow.nodes)) throw new Error('JSON de workflow inválido');
console.log('Importe workflow_pqrs_soporte.json mediante n8n > menú de tres puntos > Import from File.');
console.log('Este script no abre ni modifica la base de datos interna de n8n.');

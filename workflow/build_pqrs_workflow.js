// Generador local. Solo escribe el JSON contiguo; no accede a bases internas de n8n.
const fs = require('node:fs');
const path = require('node:path');
const workflow = {
  "id": "pqrs_workflow_v1",
  "name": "Gestión de PQRS y Soporte - Corregido",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "radicar-pqrs",
        "responseMode": "responseNode",
        "authentication": "none",
        "options": {
          "allowedOrigins": "*"
        }
      },
      "id": "1ee48009-1824-5224-867c-a4c72a8ee74c",
      "name": "Webhook Radicación PQRS",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2,
      "position": [
        -1400,
        0
      ],
      "webhookId": "cf3ba236-2549-5a7d-bd09-da2c53b69b88"
    },
    {
      "parameters": {
        "jsCode": "let correo_remitente = 'soporte@vafel.com';\nlet correo_responsable = 'admin@vafel.com';\nlet portal_url = 'http://localhost:5173';\ntry {\n  if (typeof $env !== 'undefined') {\n    correo_remitente = $env.PQRS_CORREO_REMITENTE || correo_remitente;\n    correo_responsable = $env.PQRS_CORREO_RESPONSABLE || correo_responsable;\n    portal_url = $env.PORTAL_PUBLIC_URL || portal_url;\n  }\n} catch (e) {}\nconst config = { correo_remitente, correo_responsable, portal_url };\nconst raw = $json.body ?? $json;\nconst errores = [];\nconst norm = s => s.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase();\nconst uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;\nconst emailRE = /^[^\\s@<>\\r\\n]+@[^\\s@<>\\r\\n]+\\.[^\\s@<>\\r\\n]+$/;\nconst data = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};\nfunction text(key,min,max,optional=false) {\n const value=data[key];\n if(optional && (value===undefined || value===null)) return '';\n if(typeof value!=='string'){errores.push(key+': debe ser texto');return '';}\n const s=value.trim();\n if(s.length<min || s.length>max || /[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f]/.test(s)) errores.push(key+': longitud o caracteres inválidos');\n return s;\n}\nconst request_id=text('request_id',36,36);\nif(!uuid.test(request_id)) errores.push('request_id: se requiere un UUID v4');\nconst cliente_nombre=text('nombre',2,150).replace(/\\s+/g,' ');\nconst cliente_email=text('email',3,180).toLowerCase();\nif(!emailRE.test(cliente_email)) errores.push('email: formato inválido');\nconst cliente_telefono=text('telefono',0,40,true);\nconst asunto=text('asunto',3,250).replace(/\\s+/g,' ');\nconst descripcion=text('descripcion',5,5000);\nfunction choice(key,values,fallback) {\n const raw=text(key,0,100,true)||fallback;\n const value=values.find(v=>norm(v)===norm(raw));\n if(!value)errores.push(key+': opción inválida');\n return value;\n}\nconst tipo=choice('tipo_solicitud',['Petición','Queja','Reclamo','Soporte Técnico','Sugerencia'],'Petición');\nconst prioridad=choice('prioridad',['Baja','Media','Alta','Crítica'],'Media');\nlet departamento=text('departamento',0,100,true);\nconst areas=['Soporte Técnico y Sistemas','Facturación y Cobranzas','Control de Calidad y Garantías','Atención al Cliente General'];\nif(departamento){departamento=areas.find(a=>norm(a)===norm(departamento));if(!departamento)errores.push('departamento: opción inválida');}\nelse if(tipo==='Soporte Técnico')departamento=areas[0];\nelse if(/factur|cobro/.test(norm(asunto+' '+descripcion)))departamento=areas[1];\nelse if(tipo==='Queja'||tipo==='Reclamo')departamento=areas[2];else departamento=areas[3];\nif(errores.length) return [{json:{valido:false,codigo:400,respuesta:{status:'error',codigo:400,guardada:false,mensaje:'Revise los datos de la solicitud',errores}}}];\nif(!emailRE.test(config.correo_remitente)||!emailRE.test(config.correo_responsable))return [{json:{valido:false,codigo:503,respuesta:{status:'error',codigo:503,guardada:null,mensaje:'Falta configurar los correos del workflow. Conserve el identificador de la solicitud para reintentar.'}}}];\nconst datos={request_id:request_id.toLowerCase(),cliente_nombre,cliente_email,cliente_telefono,tipo,prioridad,departamento,asunto,descripcion};\nreturn [{json:{valido:true,...datos,datos,config,sla_horas:prioridad==='Crítica'?2:prioridad==='Alta'||tipo==='Reclamo'?4:prioridad==='Baja'?48:24,es_urgente:prioridad==='Alta'||prioridad==='Crítica'||tipo==='Reclamo'}}];"
      },
      "id": "8843941d-3da9-5b8c-b423-f02d81047a36",
      "name": "Procesador y Clasificador de Solicitudes",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        -1160,
        0
      ]
    },
    {
      "parameters": {
        "conditions": {
          "boolean": [
            {
              "value1": "={{ $json.valido }}",
              "operation": "equal",
              "value2": true
            }
          ]
        }
      },
      "id": "bef3c91f-8f8a-59a5-b58b-3fb1da4b2bc8",
      "name": "¿Datos Válidos?",
      "type": "n8n-nodes-base.if",
      "typeVersion": 1,
      "position": [
        -920,
        0
      ]
    },
    {
      "parameters": {
        "operation": "executeQuery",
        "query": "SELECT pqrs_radicar($1::jsonb) AS resultado;",
        "options": {
          "queryReplacement": "={{ [JSON.stringify($json.datos)] }}"
        }
      },
      "id": "c56d0e10-e602-5b0b-b7c3-4137519cc84f",
      "name": "Guardar en Base de Datos PostgreSQL",
      "type": "n8n-nodes-base.postgres",
      "typeVersion": 2.6,
      "position": [
        -680,
        -80
      ],
      "onError": "continueErrorOutput"
    },
    {
      "parameters": {
        "conditions": {
          "boolean": [
            {
              "value1": "={{ $json.resultado.creada }}",
              "operation": "equal",
              "value2": true
            }
          ]
        }
      },
      "id": "85c66b28-208f-50ad-9503-924da7d6ca5d",
      "name": "¿Solicitud nueva?",
      "type": "n8n-nodes-base.if",
      "typeVersion": 1,
      "position": [
        -440,
        -80
      ]
    },
    {
      "parameters": {
        "fromEmail": "={{ $('Procesador y Clasificador de Solicitudes').first().json.config.correo_remitente }}",
        "toEmail": "={{ $('Guardar en Base de Datos PostgreSQL').first().json.resultado.solicitud.cliente_email }}",
        "subject": "={{ 'Confirmación: '+$('Guardar en Base de Datos PostgreSQL').first().json.resultado.solicitud.ticket_id }}",
        "emailFormat": "text",
        "text": "={{ ['Solicitud: '+$('Guardar en Base de Datos PostgreSQL').first().json.resultado.solicitud.ticket_id,'Clave privada de consulta: '+$('Guardar en Base de Datos PostgreSQL').first().json.resultado.solicitud.tracking_token,'Enlace de seguimiento privado: '+(($('Procesador y Clasificador de Solicitudes').first().json.config.portal_url||'http://localhost:5173')+'/#token='+$('Guardar en Base de Datos PostgreSQL').first().json.resultado.solicitud.tracking_token+'&id='+$('Guardar en Base de Datos PostgreSQL').first().json.resultado.solicitud.ticket_id),'Tipo: '+$('Guardar en Base de Datos PostgreSQL').first().json.resultado.solicitud.tipo,'Prioridad: '+$('Guardar en Base de Datos PostgreSQL').first().json.resultado.solicitud.prioridad,'Área: '+$('Guardar en Base de Datos PostgreSQL').first().json.resultado.solicitud.departamento,'Asunto: '+$('Guardar en Base de Datos PostgreSQL').first().json.resultado.solicitud.asunto,'Plazo: '+$('Guardar en Base de Datos PostgreSQL').first().json.resultado.solicitud.sla_horas+' horas corridas','Fecha límite: '+$('Guardar en Base de Datos PostgreSQL').first().json.resultado.solicitud.sla_fecha_limite,'Conserve el radicado y la clave para consultar el caso en el portal de solicitudes.'].join('\\n') }}",
        "options": {
          "appendAttribution": false
        }
      },
      "id": "33cfdbe1-f70d-5332-83d6-999d0b4a948e",
      "name": "Notificación Email al Cliente (SMTP)",
      "type": "n8n-nodes-base.emailSend",
      "typeVersion": 2.1,
      "position": [
        -200,
        -160
      ],
      "onError": "continueRegularOutput",
      "alwaysOutputData": true
    },
    {
      "parameters": {
        "jsCode": "const info=$json;\nconst recipient=$('Guardar en Base de Datos PostgreSQL').first().json.resultado.solicitud.cliente_email.toLowerCase();\nconst addresses=list=>Array.isArray(list)?list.map(x=>String(typeof x==='string'?x:x?.address||'').toLowerCase()):[];\nconst accepted=addresses(info.accepted),rejected=addresses(info.rejected);\nconst estado=accepted.includes(recipient)?'ENVIADA':rejected.includes(recipient)?'ERROR':'SIN_CONFIRMAR';\nreturn [{json:{request_id:$('Guardar en Base de Datos PostgreSQL').first().json.resultado.solicitud.request_id,canal:'confirmacion',estado,detalle:estado==='ENVIADA'?null:estado==='ERROR'?'El servidor rechazó al destinatario':'No hay confirmación de aceptación. Revisar ejecución y proveedor antes de reenviar.'}}];"
      },
      "id": "6b49f763-7d33-50b7-b955-c412dfce0068",
      "name": "Comprobar correo de confirmación",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        40,
        -160
      ]
    },
    {
      "parameters": {
        "operation": "executeQuery",
        "query": "SELECT pqrs_registrar_correo($1::uuid,$2::text,$3::text,$4::text) AS resultado;",
        "options": {
          "queryReplacement": "={{ [$json.request_id,$json.canal,$json.estado,$json.detalle] }}"
        }
      },
      "id": "05043252-8690-596c-b988-bf3435e8602d",
      "name": "Guardar resultado de confirmación",
      "type": "n8n-nodes-base.postgres",
      "typeVersion": 2.6,
      "position": [
        280,
        -160
      ],
      "onError": "continueRegularOutput"
    },
    {
      "parameters": {
        "conditions": {
          "boolean": [
            {
              "value1": "={{ $('Guardar en Base de Datos PostgreSQL').first().json.resultado.solicitud.es_urgente }}",
              "operation": "equal",
              "value2": true
            }
          ]
        }
      },
      "id": "4d4fb42f-dc6b-5adb-8772-f011d6c12352",
      "name": "¿Es Solicitud Urgente?",
      "type": "n8n-nodes-base.if",
      "typeVersion": 1,
      "position": [
        520,
        -160
      ]
    },
    {
      "parameters": {
        "fromEmail": "={{ $('Procesador y Clasificador de Solicitudes').first().json.config.correo_remitente }}",
        "toEmail": "={{ $('Procesador y Clasificador de Solicitudes').first().json.config.correo_responsable }}",
        "subject": "={{ 'URGENTE: '+$('Guardar en Base de Datos PostgreSQL').first().json.resultado.solicitud.ticket_id }}",
        "emailFormat": "text",
        "text": "={{ ['ALERTA DE SOLICITUD URGENTE','Radicado: '+$('Guardar en Base de Datos PostgreSQL').first().json.resultado.solicitud.ticket_id,'Cliente: '+$('Guardar en Base de Datos PostgreSQL').first().json.resultado.solicitud.cliente_nombre,'Correo: '+$('Guardar en Base de Datos PostgreSQL').first().json.resultado.solicitud.cliente_email,'Área: '+$('Guardar en Base de Datos PostgreSQL').first().json.resultado.solicitud.departamento,'Prioridad: '+$('Guardar en Base de Datos PostgreSQL').first().json.resultado.solicitud.prioridad,'Asunto: '+$('Guardar en Base de Datos PostgreSQL').first().json.resultado.solicitud.asunto,'Descripción: '+$('Guardar en Base de Datos PostgreSQL').first().json.resultado.solicitud.descripcion,'Plazo: '+$('Guardar en Base de Datos PostgreSQL').first().json.resultado.solicitud.sla_horas+' horas corridas','Ingrese al Workspace Agente para asignar o gestionar el caso.'].join('\\n') }}",
        "options": {
          "appendAttribution": false
        }
      },
      "id": "e6c7f5c8-5d3c-52d0-ac54-c1e3db750707",
      "name": "Alerta Escalamiento Inmediato",
      "type": "n8n-nodes-base.emailSend",
      "typeVersion": 2.1,
      "position": [
        760,
        -280
      ],
      "onError": "continueRegularOutput",
      "alwaysOutputData": true
    },
    {
      "parameters": {
        "jsCode": "const info=$json;\nconst recipient=$('Procesador y Clasificador de Solicitudes').first().json.config.correo_responsable.toLowerCase();\nconst addresses=list=>Array.isArray(list)?list.map(x=>String(typeof x==='string'?x:x?.address||'').toLowerCase()):[];\nconst accepted=addresses(info.accepted),rejected=addresses(info.rejected);\nconst estado=accepted.includes(recipient)?'ENVIADA':rejected.includes(recipient)?'ERROR':'SIN_CONFIRMAR';\nreturn [{json:{request_id:$('Guardar en Base de Datos PostgreSQL').first().json.resultado.solicitud.request_id,canal:'alerta',estado,detalle:estado==='ENVIADA'?null:estado==='ERROR'?'El servidor rechazó al destinatario':'No hay confirmación de aceptación. Revisar ejecución y proveedor antes de reenviar.'}}];"
      },
      "id": "b255fbb9-90a2-5baa-a5f1-5aaadb2721c0",
      "name": "Comprobar correo de alerta",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        1000,
        -280
      ]
    },
    {
      "parameters": {
        "operation": "executeQuery",
        "query": "SELECT pqrs_registrar_correo($1::uuid,$2::text,$3::text,$4::text) AS resultado;",
        "options": {
          "queryReplacement": "={{ [$json.request_id,$json.canal,$json.estado,$json.detalle] }}"
        }
      },
      "id": "2dbd3484-e5b4-5752-abc9-2a0d5dc5f417",
      "name": "Guardar resultado de alerta",
      "type": "n8n-nodes-base.postgres",
      "typeVersion": 2.6,
      "position": [
        1240,
        -280
      ],
      "onError": "continueRegularOutput"
    },
    {
      "parameters": {
        "operation": "executeQuery",
        "query": "SELECT (SELECT to_jsonb(s) FROM pqrs_solicitudes s WHERE request_id=$1::uuid) AS solicitud;",
        "options": {
          "queryReplacement": "={{ [$('Guardar en Base de Datos PostgreSQL').first().json.resultado.solicitud.request_id] }}"
        }
      },
      "id": "83cb5912-ffdc-5655-80ca-3fbec0184d71",
      "name": "Consultar resultado final",
      "type": "n8n-nodes-base.postgres",
      "typeVersion": 2.6,
      "position": [
        1480,
        -80
      ],
      "onError": "continueErrorOutput"
    },
    {
      "parameters": {
        "jsCode": "const result=$json.resultado;\nif(result && result.coincide===false)return [{json:{codigo:409,respuesta:{status:'error',codigo:409,guardada:null,mensaje:'El identificador ya se utilizó con otros datos. Revise la solicitud original.'}}}];\nconst s=$json.solicitud || result?.solicitud;\nif(!s)return [{json:{codigo:503,respuesta:{status:'error',codigo:503,guardada:null,mensaje:'No se pudo confirmar el resultado. Reintente con el mismo identificador.'}}}];\nconst duplicada=!!result && result.creada===false;\nconst correoOk=s.confirmacion_estado==='ENVIADA'&&(!s.es_urgente||s.alerta_estado==='ENVIADA');\nconst codigo=duplicada?200:correoOk?201:202;\nreturn [{json:{codigo,respuesta:{status:'success',codigo,guardada:true,duplicada,request_id:s.request_id,ticket_id:s.ticket_id,tracking_token:s.tracking_token,\n tipo:s.tipo,prioridad:s.prioridad,departamento:s.departamento,sla_horas:s.sla_horas,sla_fecha_limite:s.sla_fecha_limite,estado:s.estado,es_urgente:s.es_urgente,\n confirmacion_estado:s.confirmacion_estado,alerta_estado:s.alerta_estado,\n mensaje:duplicada?'Solicitud ya registrada. No se repitió el envío.':correoOk?'Solicitud registrada y mensajes aceptados por el servidor de correo.':'Solicitud registrada. Hay notificaciones pendientes de comprobar; el registro no debe repetirse.'}}}];"
      },
      "id": "99c4cbe2-eaa4-55ac-96f1-c12841b2f489",
      "name": "Preparar confirmación de registro",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        1720,
        -80
      ]
    },
    {
      "parameters": {
        "jsCode": "const result=$json.resultado;\nif(result && result.coincide===false)return [{json:{codigo:409,respuesta:{status:'error',codigo:409,guardada:null,mensaje:'El identificador ya se utilizó con otros datos. Revise la solicitud original.'}}}];\nconst s=$json.solicitud || result?.solicitud;\nif(!s)return [{json:{codigo:503,respuesta:{status:'error',codigo:503,guardada:null,mensaje:'No se pudo confirmar el resultado. Reintente con el mismo identificador.'}}}];\nconst duplicada=!!result && result.creada===false;\nconst correoOk=s.confirmacion_estado==='ENVIADA'&&(!s.es_urgente||s.alerta_estado==='ENVIADA');\nconst codigo=duplicada?200:correoOk?201:202;\nreturn [{json:{codigo,respuesta:{status:'success',codigo,guardada:true,duplicada,request_id:s.request_id,ticket_id:s.ticket_id,tracking_token:s.tracking_token,\n tipo:s.tipo,prioridad:s.prioridad,departamento:s.departamento,sla_horas:s.sla_horas,sla_fecha_limite:s.sla_fecha_limite,estado:s.estado,es_urgente:s.es_urgente,\n confirmacion_estado:s.confirmacion_estado,alerta_estado:s.alerta_estado,\n mensaje:duplicada?'Solicitud ya registrada. No se repitió el envío.':correoOk?'Solicitud registrada y mensajes aceptados por el servidor de correo.':'Solicitud registrada. Hay notificaciones pendientes de comprobar; el registro no debe repetirse.'}}}];"
      },
      "id": "6123ea88-8359-558d-bf9a-e5b974b43d40",
      "name": "Preparar respuesta de reintento",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        -200,
        100
      ]
    },
    {
      "parameters": {
        "jsCode": "return [{json:{codigo:503,respuesta:{status:'error',codigo:503,guardada:null,mensaje:'No se pudo confirmar el almacenamiento. Conserve el identificador y reintente la misma solicitud.'}}}];"
      },
      "id": "f50ba21c-57ea-562c-9708-5e90af491f45",
      "name": "Error de almacenamiento",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        -440,
        300
      ]
    },
    {
      "parameters": {
        "jsCode": "const s=$('Guardar en Base de Datos PostgreSQL').first().json.resultado.solicitud;return [{json:{solicitud:{...s,confirmacion_estado:'SIN_CONFIRMAR',alerta_estado:s.es_urgente?'SIN_CONFIRMAR':'NO_APLICA'}}}];"
      },
      "id": "f3272c74-a7f8-598d-9e44-228e4eccd984",
      "name": "Estado de correo no confirmado",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        1480,
        160
      ]
    },
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ $json.respuesta }}",
        "options": {
          "responseCode": "={{ $json.codigo }}",
          "responseHeaders": {
            "entries": [
              {
                "name": "Cache-Control",
                "value": "no-store"
              },
              {
                "name": "Referrer-Policy",
                "value": "no-referrer"
              }
            ]
          }
        }
      },
      "id": "b5488e11-817d-5874-8f15-5347eee6b61b",
      "name": "Respuesta Radicación Webhook",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1.1,
      "position": [
        1960,
        100
      ]
    },
    {
      "parameters": {
        "httpMethod": "GET",
        "path": "consultar-pqrs",
        "responseMode": "responseNode",
        "authentication": "basicAuth",
        "options": {
          "allowedOrigins": "*"
        }
      },
      "id": "e8bce867-d8c3-568e-a97e-bf394f6b609c",
      "name": "Webhook Consultar PQRS",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2,
      "position": [
        -1400,
        700
      ],
      "webhookId": "1e2089e7-33ba-59d9-ae2a-21e6edd25131"
    },
    {
      "parameters": {
        "operation": "executeQuery",
        "query": "SELECT pqrs_listar() AS resultado;",
        "options": {
          "queryReplacement": ""
        }
      },
      "id": "ae360f20-0952-5fcf-a925-5679acc1dbc6",
      "name": "Consultar Registros en Postgres",
      "type": "n8n-nodes-base.postgres",
      "typeVersion": 2.6,
      "position": [
        -1160,
        700
      ],
      "onError": "continueErrorOutput"
    },
    {
      "parameters": {
        "jsCode": "return [{json:{codigo:200,respuesta:$json.resultado}}];"
      },
      "id": "80f0aaa3-2c6a-5de6-9020-75a2a37acd26",
      "name": "Formatear Estadísticas y KPIs",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        -920,
        700
      ]
    },
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ $json.respuesta }}",
        "options": {
          "responseCode": "={{ $json.codigo }}",
          "responseHeaders": {
            "entries": [
              {
                "name": "Cache-Control",
                "value": "no-store"
              },
              {
                "name": "Referrer-Policy",
                "value": "no-referrer"
              }
            ]
          }
        }
      },
      "id": "42de3f31-0e0f-5e89-9639-1febc6d0ea30",
      "name": "Respuesta Listado Webhook",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1.1,
      "position": [
        -680,
        700
      ]
    },
    {
      "parameters": {
        "jsCode": "return [{json:{codigo:503,respuesta:{status:'error',codigo:503,mensaje:'No fue posible consultar PostgreSQL'}}}];"
      },
      "id": "f1a41ece-1059-5ec4-ad34-ced742ad53c2",
      "name": "Error de consulta",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        -920,
        900
      ]
    },
    {
      "parameters": {
        "httpMethod": "GET",
        "path": "consultar-ticket",
        "responseMode": "responseNode",
        "authentication": "none",
        "options": {
          "allowedOrigins": "*"
        }
      },
      "id": "8b90ae0d-cbc3-5cc8-a3dd-b3e86eb9862e",
      "name": "Webhook Tracking Público",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2,
      "position": [
        -1400,
        1200
      ],
      "webhookId": "4edefaaa-8d58-5727-b219-b99d6df9dcfc"
    },
    {
      "parameters": {
        "jsCode": "const q=$json.query ?? $json;\nconst id=typeof q.id==='string'?q.id.trim().toUpperCase():'';\nconst token=typeof q.token==='string'?q.token.trim().toLowerCase():'';\nconst valido=/^PQRS-\\d{4}-\\d{6,20}$/.test(id)&&id.length<=30&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);\nreturn [{json:{valido,id,token,codigo:400,respuesta:{status:'error',codigo:400,mensaje:'Ingrese radicado y clave de consulta válidos'}}}];"
      },
      "id": "8fee2f0f-0722-55a8-8045-de713692f998",
      "name": "Validar consulta pública",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        -1160,
        1200
      ]
    },
    {
      "parameters": {
        "conditions": {
          "boolean": [
            {
              "value1": "={{ $json.valido }}",
              "operation": "equal",
              "value2": true
            }
          ]
        }
      },
      "id": "9daccd2d-3087-5c51-b0c2-b56fb6e6cad2",
      "name": "¿Consulta válida?",
      "type": "n8n-nodes-base.if",
      "typeVersion": 1,
      "position": [
        -920,
        1200
      ]
    },
    {
      "parameters": {
        "operation": "executeQuery",
        "query": "SELECT pqrs_tracking($1::text,$2::uuid) AS resultado;",
        "options": {
          "queryReplacement": "={{ [$json.id,$json.token] }}"
        }
      },
      "id": "d49b4673-bff8-5125-9638-0d5f1dc244d9",
      "name": "Consultar Ticket y Timeline en Postgres",
      "type": "n8n-nodes-base.postgres",
      "typeVersion": 2.6,
      "position": [
        -680,
        1120
      ],
      "onError": "continueErrorOutput"
    },
    {
      "parameters": {
        "jsCode": "return [{json:{codigo:$json.resultado.codigo,respuesta:$json.resultado}}];"
      },
      "id": "1e6bfb03-e8f8-5a35-bd76-4ee6a4877f78",
      "name": "Formatear Respuesta Tracking",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        -440,
        1120
      ]
    },
    {
      "parameters": {
        "jsCode": "return [{json:{codigo:503,respuesta:{status:'error',codigo:503,mensaje:'No fue posible consultar el ticket'}}}];"
      },
      "id": "6b3a6596-c3a6-525b-b01f-d0e8cb8d37a1",
      "name": "Error de seguimiento",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        -440,
        1320
      ]
    },
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ $json.respuesta }}",
        "options": {
          "responseCode": "={{ $json.codigo }}",
          "responseHeaders": {
            "entries": [
              {
                "name": "Cache-Control",
                "value": "no-store"
              },
              {
                "name": "Referrer-Policy",
                "value": "no-referrer"
              }
            ]
          }
        }
      },
      "id": "f4a1ae39-d281-51da-83b3-0e8a6159408d",
      "name": "Respuesta Tracking Webhook",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1.1,
      "position": [
        -200,
        1200
      ]
    },
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "actualizar-ticket",
        "responseMode": "responseNode",
        "authentication": "basicAuth",
        "options": {
          "allowedOrigins": "*"
        }
      },
      "id": "17a44a93-8dc5-5fdb-a412-6f4eb4a11dac",
      "name": "Webhook Actualizar Ticket",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2,
      "position": [
        -1400,
        1750
      ],
      "webhookId": "36920016-3334-556e-9c70-ca3b1366ac1f"
    },
    {
      "parameters": {
        "jsCode": "const d=$json.body ?? $json;\nconst errors=[];\nconst uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;\nconst uuid4=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;\nconst obj=d&&typeof d==='object'&&!Array.isArray(d)?d:{};\nconst str=k=>typeof obj[k]==='string'?obj[k].trim():'';\nconst ticket_id=str('ticket_id').toUpperCase();const operation_id=str('operation_id').toLowerCase();\nconst nuevo_estado=str('nuevo_estado');const agente_id=str('agente_id').toLowerCase();const mensaje_resolucion=str('mensaje_resolucion');\nif(!/^PQRS-\\d{4}-\\d{6,20}$/.test(ticket_id)||ticket_id.length>30)errors.push('Radicado inválido');\nif(!uuid4.test(operation_id))errors.push('Identificador de operación inválido');\nif(!uuid.test(agente_id))errors.push('Seleccione un agente');\nif(!['NUEVO','ASIGNADO','EN_GESTION','ESPERANDO_CLIENTE','RESUELTO','CERRADO'].includes(nuevo_estado))errors.push('Estado inválido');\nif(!mensaje_resolucion||mensaje_resolucion.length>2000||/[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f]/.test(mensaje_resolucion))errors.push('Nota inválida (1 a 2000 caracteres)');\nif(typeof obj.es_nota_interna!=='boolean')errors.push('es_nota_interna debe ser booleano');\nif(!Number.isSafeInteger(obj.version)||obj.version<1)errors.push('Versión inválida');\nif(errors.length)return [{json:{valido:false,codigo:400,respuesta:{status:'error',codigo:400,mensaje:'Datos de actualización inválidos',errores:errors}}}];\nreturn [{json:{valido:true,datos:{ticket_id,operation_id,nuevo_estado,agente_id,mensaje_resolucion,es_nota_interna:obj.es_nota_interna,version:obj.version}}}];"
      },
      "id": "90292ceb-4e7b-5d32-af7b-7e3d7e94386e",
      "name": "Validar Actualización",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        -1160,
        1750
      ]
    },
    {
      "parameters": {
        "conditions": {
          "boolean": [
            {
              "value1": "={{ $json.valido }}",
              "operation": "equal",
              "value2": true
            }
          ]
        }
      },
      "id": "9dbb3e56-dce9-53af-9f40-59a879839ad8",
      "name": "¿Actualización válida?",
      "type": "n8n-nodes-base.if",
      "typeVersion": 1,
      "position": [
        -920,
        1750
      ]
    },
    {
      "parameters": {
        "operation": "executeQuery",
        "query": "SELECT pqrs_actualizar($1::jsonb) AS resultado;",
        "options": {
          "queryReplacement": "={{ [JSON.stringify($json.datos)] }}"
        }
      },
      "id": "8cbf69d3-027e-541f-9725-00c418f882cc",
      "name": "Actualizar Estado y Actividad en Postgres",
      "type": "n8n-nodes-base.postgres",
      "typeVersion": 2.6,
      "position": [
        -680,
        1670
      ],
      "onError": "continueErrorOutput"
    },
    {
      "parameters": {
        "jsCode": "return [{json:{codigo:$json.resultado.codigo,respuesta:$json.resultado}}];"
      },
      "id": "a2662c7a-8834-5af3-ade8-b6d42c96bbf3",
      "name": "Preparar resultado de actualización",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        -440,
        1670
      ]
    },
    {
      "parameters": {
        "jsCode": "return [{json:{codigo:503,respuesta:{status:'error',codigo:503,mensaje:'No se pudo confirmar la actualización. Reintente la misma operación o consulte el estado.'}}}];"
      },
      "id": "e828ad31-7d47-559e-bb52-c0802e5b31ae",
      "name": "Error de actualización",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        -440,
        1870
      ]
    },
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ $json.respuesta }}",
        "options": {
          "responseCode": "={{ $json.codigo }}",
          "responseHeaders": {
            "entries": [
              {
                "name": "Cache-Control",
                "value": "no-store"
              },
              {
                "name": "Referrer-Policy",
                "value": "no-referrer"
              }
            ]
          }
        }
      },
      "id": "388aa6a9-65c9-5782-a02c-dcfe03d9cd4b",
      "name": "Respuesta Actualización Webhook",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1.1,
      "position": [
        -200,
        1750
      ]
    },
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "calificar-ticket",
        "responseMode": "responseNode",
        "authentication": "none",
        "options": {
          "allowedOrigins": "*"
        }
      },
      "id": "c1000001-0001-4000-8000-000000000001",
      "name": "Webhook Calificar Ticket",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2,
      "position": [
        -1400,
        2200
      ],
      "webhookId": "c1000001-csat-4000-8000-calificar00001"
    },
    {
      "parameters": {
        "jsCode": "const d=$json.body ?? $json;\nconst errors=[];\nconst uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;\nconst obj=d&&typeof d==='object'&&!Array.isArray(d)?d:{};\nconst str=k=>typeof obj[k]==='string'?obj[k].trim():'';\nconst ticket_id=str('ticket_id').toUpperCase();\nconst token=str('token').toLowerCase();\nconst puntuacion=Number(obj.puntuacion);\nconst retroalimentacion=str('retroalimentacion');\nif(!/^PQRS-\\d{4}-\\d{6,20}$/.test(ticket_id))errors.push('Radicado inválido');\nif(!uuid.test(token))errors.push('Clave privada de consulta inválida');\nif(!Number.isInteger(puntuacion)||puntuacion<1||puntuacion>5)errors.push('La puntuación debe ser entre 1 y 5');\nif(retroalimentacion.length>500)errors.push('El comentario admite máximo 500 caracteres');\nif(errors.length)return [{json:{valido:false,codigo:400,respuesta:{status:'error',codigo:400,mensaje:'Datos de calificación inválidos',errores:errors}}}];\nreturn [{json:{valido:true,datos:{ticket_id,token,puntuacion,retroalimentacion}}}];"
      },
      "id": "c1000002-0002-4000-8000-000000000002",
      "name": "Validar Calificación",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        -1160,
        2200
      ]
    },
    {
      "parameters": {
        "conditions": {
          "boolean": [
            {
              "value1": "={{ $json.valido }}",
              "operation": "equal",
              "value2": true
            }
          ]
        }
      },
      "id": "c1000003-0003-4000-8000-000000000003",
      "name": "¿Calificación válida?",
      "type": "n8n-nodes-base.if",
      "typeVersion": 1,
      "position": [
        -920,
        2200
      ]
    },
    {
      "parameters": {
        "operation": "executeQuery",
        "query": "SELECT pqrs_calificar($1::text,$2::uuid,$3::int,$4::text) AS resultado;",
        "options": {
          "queryReplacement": "={{ [$json.datos.ticket_id,$json.datos.token,$json.datos.puntuacion,$json.datos.retroalimentacion] }}"
        }
      },
      "id": "c1000004-0004-4000-8000-000000000004",
      "name": "Guardar Calificación en Postgres",
      "type": "n8n-nodes-base.postgres",
      "typeVersion": 2.6,
      "position": [
        -680,
        2120
      ],
      "onError": "continueErrorOutput"
    },
    {
      "parameters": {
        "jsCode": "return [{json:{codigo:$json.resultado.codigo,respuesta:$json.resultado}}];"
      },
      "id": "c1000005-0005-4000-8000-000000000005",
      "name": "Preparar respuesta calificación",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        -440,
        2120
      ]
    },
    {
      "parameters": {
        "jsCode": "return [{json:{codigo:503,respuesta:{status:'error',codigo:503,mensaje:'No se pudo registrar la calificación'}}}];"
      },
      "id": "c1000006-0006-4000-8000-000000000006",
      "name": "Error de calificación",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        -440,
        2320
      ]
    },
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ $json.respuesta }}",
        "options": {
          "responseCode": "={{ $json.codigo }}",
          "responseHeaders": {
            "entries": [
              {
                "name": "Cache-Control",
                "value": "no-store"
              },
              {
                "name": "Referrer-Policy",
                "value": "no-referrer"
              }
            ]
          }
        }
      },
      "id": "c1000007-0007-4000-8000-000000000007",
      "name": "Respuesta Calificación Webhook",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1.1,
      "position": [
        -200,
        2200
      ]
    }
  ],
  "connections": {
    "Webhook Radicación PQRS": {
      "main": [
        [
          {
            "node": "Procesador y Clasificador de Solicitudes",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Procesador y Clasificador de Solicitudes": {
      "main": [
        [
          {
            "node": "¿Datos Válidos?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "¿Datos Válidos?": {
      "main": [
        [
          {
            "node": "Guardar en Base de Datos PostgreSQL",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Respuesta Radicación Webhook",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Guardar en Base de Datos PostgreSQL": {
      "main": [
        [
          {
            "node": "¿Solicitud nueva?",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Error de almacenamiento",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "¿Solicitud nueva?": {
      "main": [
        [
          {
            "node": "Notificación Email al Cliente (SMTP)",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Preparar respuesta de reintento",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Notificación Email al Cliente (SMTP)": {
      "main": [
        [
          {
            "node": "Comprobar correo de confirmación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Comprobar correo de confirmación": {
      "main": [
        [
          {
            "node": "Guardar resultado de confirmación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Guardar resultado de confirmación": {
      "main": [
        [
          {
            "node": "¿Es Solicitud Urgente?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "¿Es Solicitud Urgente?": {
      "main": [
        [
          {
            "node": "Alerta Escalamiento Inmediato",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Consultar resultado final",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Alerta Escalamiento Inmediato": {
      "main": [
        [
          {
            "node": "Comprobar correo de alerta",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Comprobar correo de alerta": {
      "main": [
        [
          {
            "node": "Guardar resultado de alerta",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Guardar resultado de alerta": {
      "main": [
        [
          {
            "node": "Consultar resultado final",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Consultar resultado final": {
      "main": [
        [
          {
            "node": "Preparar confirmación de registro",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Estado de correo no confirmado",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Preparar confirmación de registro": {
      "main": [
        [
          {
            "node": "Respuesta Radicación Webhook",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Preparar respuesta de reintento": {
      "main": [
        [
          {
            "node": "Respuesta Radicación Webhook",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Error de almacenamiento": {
      "main": [
        [
          {
            "node": "Respuesta Radicación Webhook",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Estado de correo no confirmado": {
      "main": [
        [
          {
            "node": "Preparar confirmación de registro",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Webhook Consultar PQRS": {
      "main": [
        [
          {
            "node": "Consultar Registros en Postgres",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Consultar Registros en Postgres": {
      "main": [
        [
          {
            "node": "Formatear Estadísticas y KPIs",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Error de consulta",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Formatear Estadísticas y KPIs": {
      "main": [
        [
          {
            "node": "Respuesta Listado Webhook",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Error de consulta": {
      "main": [
        [
          {
            "node": "Respuesta Listado Webhook",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Webhook Tracking Público": {
      "main": [
        [
          {
            "node": "Validar consulta pública",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Validar consulta pública": {
      "main": [
        [
          {
            "node": "¿Consulta válida?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "¿Consulta válida?": {
      "main": [
        [
          {
            "node": "Consultar Ticket y Timeline en Postgres",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Respuesta Tracking Webhook",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Consultar Ticket y Timeline en Postgres": {
      "main": [
        [
          {
            "node": "Formatear Respuesta Tracking",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Error de seguimiento",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Formatear Respuesta Tracking": {
      "main": [
        [
          {
            "node": "Respuesta Tracking Webhook",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Error de seguimiento": {
      "main": [
        [
          {
            "node": "Respuesta Tracking Webhook",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Webhook Actualizar Ticket": {
      "main": [
        [
          {
            "node": "Validar Actualización",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Validar Actualización": {
      "main": [
        [
          {
            "node": "¿Actualización válida?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "¿Actualización válida?": {
      "main": [
        [
          {
            "node": "Actualizar Estado y Actividad en Postgres",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Respuesta Actualización Webhook",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Actualizar Estado y Actividad en Postgres": {
      "main": [
        [
          {
            "node": "Preparar resultado de actualización",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Error de actualización",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Preparar resultado de actualización": {
      "main": [
        [
          {
            "node": "Respuesta Actualización Webhook",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Error de actualización": {
      "main": [
        [
          {
            "node": "Respuesta Actualización Webhook",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Webhook Calificar Ticket": {
      "main": [
        [
          {
            "node": "Validar Calificación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Validar Calificación": {
      "main": [
        [
          {
            "node": "¿Calificación válida?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "¿Calificación válida?": {
      "main": [
        [
          {
            "node": "Guardar Calificación en Postgres",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Respuesta Calificación Webhook",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Guardar Calificación en Postgres": {
      "main": [
        [
          {
            "node": "Preparar respuesta calificación",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Error de calificación",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Preparar respuesta calificación": {
      "main": [
        [
          {
            "node": "Respuesta Calificación Webhook",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Error de calificación": {
      "main": [
        [
          {
            "node": "Respuesta Calificación Webhook",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "pinData": {},
  "active": false,
  "settings": {
    "executionOrder": "v1",
    "timezone": "America/Bogota",
    "saveDataSuccessExecution": "all",
    "saveDataErrorExecution": "all",
    "executionTimeout": 120
  }
};
const output = path.join(__dirname, 'n8n_workflow.json');
fs.writeFileSync(output, JSON.stringify(workflow, null, 2) + '\n', 'utf8');
console.log('JSON generado: ' + output + '. Importe este archivo desde el editor n8n.');

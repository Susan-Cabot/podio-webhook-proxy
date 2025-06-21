exports.handler = async (event, context) => {
  console.log('🔔 Webhook recibido:', new Date().toISOString());

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'text/plain' },
      body: 'Method Not Allowed'
    };
  }

  try {
    const body = event.body;
    const params = new URLSearchParams(body);
    const data = Object.fromEntries(params);
    console.log('📊 Datos recibidos:', JSON.stringify(data, null, 2));

    // VERIFICACIÓN WEBHOOK
    if (params.get('type') === 'hook.verify') {
      const code = params.get('code');
      const hookId = params.get('hook_id');
      
      console.log('✅ VERIFICACIÓN solicitada');
      console.log('📝 Hook ID:', hookId);
      console.log('🔑 Código recibido:', code);

      // PASO 1: Responder inmediatamente 
      const webhookResponse = {
        statusCode: 200,
        headers: { 'Content-Type': 'text/plain' },
        body: code
      };

      // PASO 2: Probar múltiples endpoints en paralelo
      testMultipleEndpoints(hookId, code).catch(error => {
        console.error('❌ Error en pruebas de endpoints:', error);
      });

      return webhookResponse;
    }

    // DATOS REALES → MAKE
    console.log('📤 Reenviando datos reales a Make...');
    const makeUrl = 'https://hook.eu2.make.com/nisqpeb7yhi3b27jh6n215t7wap0jpc';
    
    const response = await fetch(makeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body
    });

    console.log('📨 Respuesta de Make:', response.status, response.statusText);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/plain' },
      body: 'OK'
    };

  } catch (error) {
    console.error('💥 Error en webhook proxy:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/plain' },
      body: 'Internal Server Error'
    };
  }
};

// Función para probar múltiples endpoints y métodos
async function testMultipleEndpoints(hookId, code) {
  console.log('🧪 Iniciando pruebas de múltiples endpoints...');
  
  try {
    // Obtener token OAuth
    const tokenResponse = await fetch('https://api.podio.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'grant_type': 'app',
        'app_id': '30361227',
        'app_token': 'fe2e7087f07470d142a5b883ef4a647e',
        'client_id': 'api-regenerated',
        'client_secret': '9aEYP3rg0TEW53ywIbfXaelov3A9gIumQImsmQK3kERa3PY0JIqadWXKrglZtVvR'
      })
    });

    if (!tokenResponse.ok) {
      console.error('❌ Error obteniendo token OAuth:', await tokenResponse.text());
      return;
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    console.log('✅ Token OAuth obtenido');

    // Lista de endpoints a probar
    const endpointsToTest = [
      // Basado en tu análisis (sin /verify)
      { 
        url: `https://api.podio.com/hook/${hookId}/validate`, 
        method: 'POST',
        name: 'POST /hook/{id}/validate (TU ANÁLISIS)'
      },
      { 
        url: `https://api.podio.com/hook/${hookId}/validate`, 
        method: 'PUT',
        name: 'PUT /hook/{id}/validate'
      },
      // Variaciones de estructura
      { 
        url: `https://api.podio.com/hook/validate/${hookId}`, 
        method: 'POST',
        name: 'POST /hook/validate/{id}'
      },
      { 
        url: `https://api.podio.com/hook/${hookId}`, 
        method: 'POST',
        name: 'POST /hook/{id} (solo hook)'
      },
      { 
        url: `https://api.podio.com/hook/${hookId}`, 
        method: 'PUT',
        name: 'PUT /hook/{id}'
      },
      // Con action
      { 
        url: `https://api.podio.com/hook/${hookId}/action/validate`, 
        method: 'POST',
        name: 'POST /hook/{id}/action/validate'
      }
    ];

    // Diferentes tipos de body a probar
    const bodyVariations = [
      { data: JSON.stringify({ code: code }), contentType: 'application/json', name: 'JSON' },
      { data: `code=${code}`, contentType: 'application/x-www-form-urlencoded', name: 'FORM' },
      { data: new URLSearchParams({ code: code }), contentType: 'application/x-www-form-urlencoded', name: 'URLSearchParams' }
    ];

    // Probar cada combinación
    for (const endpoint of endpointsToTest) {
      for (const bodyVar of bodyVariations) {
        console.log(`\n🧪 Probando: ${endpoint.name} con ${bodyVar.name}`);
        console.log(`🌐 URL: ${endpoint.url}`);
        console.log(`📝 Method: ${endpoint.method}`);
        console.log(`📄 Body: ${bodyVar.data}`);

        try {
          const response = await fetch(endpoint.url, {
            method: endpoint.method,
            headers: {
              'Authorization': `OAuth2 ${accessToken}`,
              'Content-Type': bodyVar.contentType
            },
            body: bodyVar.data
          });

          const responseText = await response.text();
          console.log(`📊 Resultado: ${response.status} ${response.statusText}`);
          console.log(`📄 Respuesta: ${responseText}`);

          if (response.ok) {
            console.log(`🎉 ¡ÉXITO! Endpoint funciona: ${endpoint.name} con ${bodyVar.name}`);
            return; // Salir al encontrar uno que funciona
          }

        } catch (error) {
          console.error(`❌ Error con ${endpoint.name}:`, error.message);
        }
      }
    }

    console.log('❌ Ningún endpoint funcionó - todos dieron error');

  } catch (error) {
    console.error('💥 Error general en pruebas:', error);
  }
}

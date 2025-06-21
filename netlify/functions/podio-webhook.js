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
    console.log('🔐 Solicitando token OAuth...');
    
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

    console.log('📡 Respuesta OAuth status:', tokenResponse.status);

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('❌ Error obteniendo token OAuth:', tokenResponse.status, errorText);
      return;
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    console.log('✅ Token OAuth obtenido exitosamente');

    // Lista REDUCIDA de endpoints más probables
    const endpointsToTest = [
      // Basado en tu análisis (sin /verify) - ESTE ES EL MÁS PROBABLE
      { 
        url: `https://api.podio.com/hook/${hookId}/validate`, 
        method: 'POST',
        name: 'POST /hook/{id}/validate'
      },
      // Estructura alternativa 
      { 
        url: `https://api.podio.com/hook/validate/${hookId}`, 
        method: 'POST',
        name: 'POST /hook/validate/{id}'
      },
      // Solo el hook ID (como sugiere la documentación)
      { 
        url: `https://api.podio.com/hook/${hookId}`, 
        method: 'POST',
        name: 'POST /hook/{id}'
      }
    ];

    console.log(`🧪 Probando ${endpointsToTest.length} endpoints principales...`);

    // Solo JSON body (más probable)
    const requestBody = JSON.stringify({ code: code });
    console.log(`📄 Body a usar: ${requestBody}`);

    // Probar cada endpoint SECUENCIALMENTE con logs inmediatos
    for (let i = 0; i < endpointsToTest.length; i++) {
      const endpoint = endpointsToTest[i];
      console.log(`\n${i+1}/${endpointsToTest.length} 🧪 Probando: ${endpoint.name}`);
      console.log(`🌐 URL: ${endpoint.url}`);

      try {
        console.log(`📡 Enviando request...`);
        
        const response = await fetch(endpoint.url, {
          method: endpoint.method,
          headers: {
            'Authorization': `OAuth2 ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: requestBody
        });

        console.log(`📊 Status recibido: ${response.status} ${response.statusText}`);

        const responseText = await response.text();
        console.log(`📄 Respuesta completa: ${responseText.substring(0, 200)}${responseText.length > 200 ? '...' : ''}`);

        if (response.ok) {
          console.log(`🎉 ¡ÉXITO! Endpoint ${endpoint.name} funcionó!`);
          console.log(`✅ WEBHOOK VALIDADO CON: ${endpoint.url}`);
          return; // Salir al encontrar uno que funciona
        } else {
          console.log(`❌ Falló con status ${response.status}`);
        }

      } catch (error) {
        console.error(`💥 Error de red con ${endpoint.name}:`, error.message);
      }

      // Pequeña pausa entre requests
      if (i < endpointsToTest.length - 1) {
        console.log(`⏳ Pausa antes del siguiente...`);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log('❌ NINGÚN ENDPOINT FUNCIONÓ - Todos dieron error');
    console.log('💡 Posibles causas: 1) Endpoint correcto no está en la lista, 2) Autenticación incorrecta, 3) Body format incorrecto');

  } catch (error) {
    console.error('💥 Error general en pruebas:', error);
  }
}

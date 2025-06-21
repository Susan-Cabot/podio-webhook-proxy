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

      // PASO 2: Probar UN endpoint simple con timeout
      testSingleEndpoint(hookId, code).catch(error => {
        console.error('❌ Error en prueba de endpoint:', error);
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

// Función para probar UN endpoint simple con timeout
async function testSingleEndpoint(hookId, code) {
  console.log('🧪 Probando endpoint simple...');
  
  try {
    console.log('🔐 Solicitando token OAuth...');
    
    // Obtener token OAuth con timeout
    const tokenController = new AbortController();
    const tokenTimeout = setTimeout(() => tokenController.abort(), 5000); // 5s timeout
    
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
      }),
      signal: tokenController.signal
    });

    clearTimeout(tokenTimeout);
    console.log('📡 Respuesta OAuth status:', tokenResponse.status);

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('❌ Error obteniendo token OAuth:', tokenResponse.status, errorText);
      return;
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    console.log('✅ Token OAuth obtenido exitosamente');

    // Probar SOLO el endpoint más probable con timeout corto
    const endpoint = `https://api.podio.com/hook/${hookId}/validate`;
    const requestBody = JSON.stringify({ code: code });
    
    console.log(`🧪 Probando: ${endpoint}`);
    console.log(`📄 Body: ${requestBody}`);

    // Request con timeout de 3 segundos
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      console.log('⏰ TIMEOUT - Request tardó más de 3 segundos');
      controller.abort();
    }, 3000);

    console.log(`📡 Enviando request con timeout 3s...`);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `OAuth2 ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: requestBody,
      signal: controller.signal
    });

    clearTimeout(timeout);
    console.log(`📊 ¡RESPUESTA RECIBIDA! Status: ${response.status} ${response.statusText}`);

    const responseText = await response.text();
    console.log(`📄 Respuesta: ${responseText.substring(0, 100)}${responseText.length > 100 ? '...' : ''}`);

    if (response.ok) {
      console.log(`🎉 ¡ÉXITO! Endpoint funcionó correctamente!`);
      console.log(`✅ WEBHOOK VALIDADO CON: ${endpoint}`);
    } else {
      console.log(`❌ Error: Status ${response.status}`);
      
      // Si es 404, probar endpoint alternativo rápidamente
      if (response.status === 404) {
        console.log(`🔄 Probando endpoint alternativo...`);
        const altEndpoint = `https://api.podio.com/hook/validate/${hookId}`;
        console.log(`🌐 Alt URL: ${altEndpoint}`);
        
        try {
          const altController = new AbortController();
          setTimeout(() => altController.abort(), 2000); // 2s timeout para alternativo
          
          const altResponse = await fetch(altEndpoint, {
            method: 'POST',
            headers: {
              'Authorization': `OAuth2 ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: requestBody,
            signal: altController.signal
          });
          
          console.log(`📊 Alt Status: ${altResponse.status}`);
          
          if (altResponse.ok) {
            console.log(`🎉 ¡ÉXITO CON ALTERNATIVO!`);
          } else {
            console.log(`❌ Alternativo también falló: ${altResponse.status}`);
          }
        } catch (altError) {
          console.log(`❌ Error en alternativo: ${altError.message}`);
        }
      }
    }

  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('⏰ Request cancelado por timeout');
    } else {
      console.error('💥 Error en prueba:', error.message);
    }
  }
}

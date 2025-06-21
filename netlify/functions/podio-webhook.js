exports.handler = async (event, context) => {
    console.log('🔔 Webhook recibido:', new Date().toISOString());
    console.log('📝 Method:', event.httpMethod);
    
    if (event.httpMethod !== 'POST') {
        console.log('❌ Método no permitido:', event.httpMethod);
        return {
            statusCode: 405,
            headers: { 'Content-Type': 'text/plain' },
            body: 'Method Not Allowed'
        };
    }

    try {
        console.log('📝 Raw body:', event.body);
        const body = event.body;
        const params = new URLSearchParams(body);
        const data = Object.fromEntries(params);
        console.log('📊 Datos recibidos:', JSON.stringify(data, null, 2));

        // VERIFICACIÓN WEBHOOK - CON API CALL
        if (params.get('type') === 'hook.verify') {
            const code = params.get('code');
            const hookId = params.get('hook_id');
            
            console.log('✅ VERIFICACIÓN solicitada');
            console.log('📝 Hook ID:', hookId);
            console.log('🔑 Código recibido:', code);
            
            // PASO 1: Responder inmediatamente a Podio
            const response = {
                statusCode: 200,
                headers: { 'Content-Type': 'text/plain' },
                body: code
            };
            
            console.log('📤 Enviando respuesta inmediata:', code);
            
            // PASO 2: Llamada API para completar verificación
            try {
                console.log('🔐 Iniciando verificación API...');
                await validateHookWithPodioAPI(hookId, code);
                console.log('🎉 ¡Verificación API completada exitosamente!');
            } catch (error) {
                console.error('❌ Error en verificación API:', error.message);
                console.error('📋 Detalles error:', error);
            }
            
            return response;
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
        
        if (!response.ok) {
            console.error('❌ Error en Make:', await response.text());
        }

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

// FUNCIÓN PARA VALIDAR WEBHOOK VIA API PODIO
async function validateHookWithPodioAPI(hookId, code) {
    console.log('🔐 Obteniendo token OAuth...');
    
    // Credenciales Podio del proyecto
    const credentials = {
        client_id: 'api-regenerated',
        client_secret: '9aEYP3rg0TEW53ywIbfXaelov3A9gIumQImsmQK3kERa3PY0JIqadWXKrglZtVvR',
        app_id: '30361227',
        app_token: 'fe2e7087f07470d142a5b883ef4a647e'
    };
    
    // PASO 1: Obtener OAuth token
    const tokenResponse = await fetch('https://api.podio.com/oauth/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            grant_type: 'app',
            app_id: credentials.app_id,
            app_token: credentials.app_token,
            client_id: credentials.client_id,
            client_secret: credentials.client_secret
        })
    });
    
    if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('❌ Error OAuth:', tokenResponse.status, errorText);
        throw new Error(`OAuth failed: ${tokenResponse.status} - ${errorText}`);
    }
    
    const tokenData = await tokenResponse.json();
    console.log('✅ Token OAuth obtenido');
    
    // PASO 2: Validar webhook
    console.log('📡 Validando webhook via API...');
    
    const validateResponse = await fetch(`https://api.podio.com/hook/${hookId}/verify`, {
        method: 'POST',
        headers: {
            'Authorization': `OAuth2 ${tokenData.access_token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            code: code
        })
    });
    
    console.log('📊 Respuesta validación:', validateResponse.status, validateResponse.statusText);
    
    if (!validateResponse.ok) {
        const errorText = await validateResponse.text();
        console.error('❌ Error validación:', validateResponse.status, errorText);
        
        // Intentar endpoint alternativo
        console.log('🔄 Probando endpoint alternativo...');
        const alternativeResponse = await fetch(`https://api.podio.com/hook/${hookId}/validate`, {
            method: 'POST',
            headers: {
                'Authorization': `OAuth2 ${tokenData.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                code: code
            })
        });
        
        console.log('📊 Respuesta alternativa:', alternativeResponse.status, alternativeResponse.statusText);
        
        if (!alternativeResponse.ok) {
            const altErrorText = await alternativeResponse.text();
            console.error('❌ Error endpoint alternativo:', alternativeResponse.status, altErrorText);
            throw new Error(`Validation failed: ${validateResponse.status} - ${errorText}`);
        }
        
        console.log('✅ Validación exitosa con endpoint alternativo');
        return;
    }
    
    console.log('✅ Validación exitosa');
}
